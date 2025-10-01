# Teller Balance Persistence Investigation

## Issue Summary
After re-authentication with Teller, account balances display as $0.00 instead of showing the actual balances that exist in the accounts. This issue occurs in the **Development environment** and affects both Checking and Savings accounts.

## User-Confirmed Symptoms
- **Environment**: Development (not sandbox)
- **Observed Behavior**: Both Checking and Savings show $0.00 after authentication
- **Expected Behavior**: Should display actual account balances
- **Confirmed**: Both accounts DO have money in them (non-zero balances)

This confirms the issue is **NOT with fetching data from Teller API**, but rather with **data storage or display** somewhere in the pipeline.

## Recent Commits Analysis

### Timeline of Changes (Last 6-7 Commits)

1. **e7be178** (Sept 30, 23:29) - PR #19
   - Added `loadAccountDataFromBackend()` to load LLC account data on page load
   - Modified initialization flow

2. **21b0b22** (Sept 30, 23:40) - PR #19
   - Modified backend to save/load transactions to database
   - Enhanced transaction persistence

3. **25b17b8** (Oct 1, 00:03) - PR #20 ⚠️ **SUSPECTED ROOT CAUSE**
   - Added hardcoded `isTellerAccount: true` flag to accountsData initialization (lines 469, 477)
   - Modified `updateDashboardBalances()` to SKIP updating Teller accounts:
     ```javascript
     if (llcBankEl && !accountsData.llcBank.isTellerAccount) llcBankEl.textContent = ...
     if (llcSavingsEl && !accountsData.llcSavings.isTellerAccount) llcBankEl.textContent = ...
     ```
   - **Problem**: Since `isTellerAccount` is always `true`, these conditions are always `false`, so Teller account balances are NEVER updated by this function

4. **b42780e** (Oct 1, 00:14) - PR #21
   - Fixed account ID merging issue (cleared old IDs on new enrollment)
   - Addressed token/account mismatch problem when user selects different accounts during re-enrollment
   - **Does NOT fix the $0.00 display issue**

## Root Cause Analysis

### The Design Issue: Split Balance Update Functions

There are **TWO separate functions** that handle balance updates with different responsibilities:

1. **`hydrateBalances()`** (lines 189-214 in app.js)
   - Fetches balance data from cached database endpoint (`/api/db/accounts/{id}/balances`)
   - Directly updates DOM elements with balance values
   - Only called during page load and after enrollment
   - Handles Teller account balance display

2. **`updateDashboardBalances()`** (lines 690-708 in app.js)
   - Updates ALL account balances on the dashboard
   - SKIPS Teller accounts due to `isTellerAccount: true` flag check
   - Called on page load (line 1292) and after various data updates (lines 877, 1059)
   - Handles non-Teller account balance display

### The Data Flow

```
User Authentication
    ↓
TellerConnect → enrollment success callback (handleRefresh)
    ↓
clearAccountIds() → Clear old account IDs
    ↓
resolveAccountIds() → Identify checking/savings from API
    ↓
persistAccountIds() → Store IDs in localStorage
    ↓
fetchFreshBalances() → Call backend /api/accounts/{id}/balances (LIVE endpoint)
    ↓
Backend on_get_balances() → Fetch from Teller API + Store to DB
    ↓
hydrateBalances() → Call backend /api/db/accounts/{id}/balances (CACHED endpoint)
    ↓
Backend on_get_cached_balances() → Retrieve from DB
    ↓
Display balance in DOM
```

### Possible Failure Points

1. **Backend Storage Failure**
   - `add_balance_snapshot()` might fail to insert into database
   - Database commit might fail silently
   - Exception handling might suppress errors

2. **Data Format Issues**
   - Balance values might be stored as wrong data type
   - String conversion might cause issues (backend converts to str)
   - Frontend `formatUSD()` might not handle certain values correctly

3. **Frontend Display Logic**
   - `hydrateBalances()` catches ALL exceptions and shows '—' on error (lines 200, 210)
   - Silent failures prevent proper error reporting
   - `formatUSD()` might format 0 or null as $0.00

4. **Timing Issues**
   - Race condition between `fetchFreshBalances()` and `hydrateBalances()`
   - Database might not be committed before cached endpoint is called
   - `Promise.all()` in fetchFreshBalances doesn't guarantee order

5. **API Response Issues**
   - Teller API might return unexpected response format
   - Development environment might have different response structure than expected
   - Token authentication might be failing silently

## Changes Made in This Branch

Added comprehensive debug logging throughout the data flow to trace where data is lost:

### Frontend Changes (static/js/app.js)

1. **`fetchFreshBalances()`**
   - Log when function is called with account IDs
   - Log API response for each balance fetch
   - Log errors without swallowing them
   - Log completion with results

2. **`hydrateBalances()`**
   - Log when function is called
   - Log each step of fetching from DB
   - Log the raw balance data retrieved
   - Log the formatted balance before setting to DOM
   - Log errors with full details
   - Log completion with both balance objects

### Backend Changes (python/teller.py)

1. **`on_get_balances()`** (Live endpoint)
   - Log when Teller API is called
   - Log Teller API response status
   - Log raw balance data from Teller
   - Log database upsert operations
   - Log successful commit

2. **`on_get_cached_balances()`** (Cached endpoint)
   - Log when cached balance is requested
   - Log if balance is found in database
   - Log the balance data being returned
   - Log if no balance found (warning level)

## Recommended Next Steps for Debugging

### Step 1: Test with Debug Logging
1. Start backend server: `cd python && python teller.py --environment development`
2. Start frontend server: `./static.sh`
3. Open browser console and backend logs side-by-side
4. Click "Refresh Data" and authenticate
5. Watch console/logs for the complete data flow

### Step 2: Verify Each Stage
Track data through each stage and confirm:
- ✓ Teller API returns valid balance data
- ✓ Backend stores to database successfully
- ✓ Database commit succeeds
- ✓ Cached endpoint retrieves correct data
- ✓ Frontend receives correct data
- ✓ formatUSD() formats correctly
- ✓ DOM element is updated

### Step 3: Check Database Directly
Run verification script to see actual stored data:
```bash
cd python
python check_storage.py
```
Look for:
- Are BalanceSnapshot records being created?
- Do they have correct available/ledger values?
- Are they associated with correct account_id?

### Step 4: Inspect Data Types
Check if issue is with data type conversion:
- Backend converts balance to `str(snapshot.available)` (line 192)
- Frontend might expect number instead of string
- `formatUSD()` implementation might not handle string "0.00" vs number 0

### Step 5: Check for Silent Failures
Look for:
- Exceptions caught and logged but not reported
- Promise rejections being swallowed
- Database transaction rollbacks
- API 404/500 responses being treated as success

## Key Questions to Answer

1. **Is data reaching the backend?**
   - Check backend logs for "[DEBUG] Teller balance data"
   
2. **Is data being stored in database?**
   - Check backend logs for "[DEBUG] Successfully committed balance"
   - Run check_storage.py to verify

3. **Is cached endpoint returning data?**
   - Check backend logs for "[DEBUG] Found cached balance"
   - Check frontend console for "[DEBUG] Checking balance from DB"

4. **Is formatUSD() working correctly?**
   - Check console for "[DEBUG] Setting checking balance to: $0.00 from available: X"
   - If available is non-zero but formatted is $0.00, formatUSD() is broken

5. **Are DOM elements being found and updated?**
   - Check if checkingEl/savingsEl are null
   - Check if textContent is actually being set

## Files Modified in This Investigation

- `static/js/app.js` - Added debug logging to balance functions
- `python/teller.py` - Added debug logging to storage and retrieval
- `INVESTIGATION_NOTES.md` - This documentation

## Related Issues

- PR #21 fixed account ID merging but didn't address balance display
- PR #20 introduced `isTellerAccount` flag logic that may have side effects
- The separation of concerns between `hydrateBalances()` and `updateDashboardBalances()` creates confusion

## Next Session TODO

1. Run the application with debug logging enabled
2. Analyze the console and backend logs to pinpoint exact failure point
3. Once failure point identified, implement targeted fix
4. Test fix thoroughly in development environment
5. Verify fix doesn't break existing functionality
6. Clean up debug logging before final commit
7. Update tests if needed
