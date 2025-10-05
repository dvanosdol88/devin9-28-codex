# Database Location Fix

**Date:** 2025-10-05
**Issue:** Balances not displaying despite data being saved

---

## Problem

Server was reading from an empty database while data existed in a different location.

**Symptoms:**
- Teller Connect enrollment succeeded
- Transactions and balances were being saved
- Frontend showed no balances
- Cached endpoints returned empty `{}`

## Root Cause

Database path issue due to relative SQLite path:

```python
# db.py line 8
db_url = os.getenv("DATABASE_URL", "sqlite:///devin_teller.db")
```

**Path Resolution:**
- Server runs from `python/` directory: `cd python && python teller.py`
- Relative path `sqlite:///devin_teller.db` resolves to `python/devin_teller.db`
- But actual data was in `./devin_teller.db` (project root)
- Server created NEW empty database at `python/devin_teller.db`

## Solution

**Moved database to correct location:**
```bash
cp ./devin_teller.db python/devin_teller.db
```

Now the server finds the data at the path it expects.

## Verification

**Before fix:**
```bash
curl http://localhost:8001/api/db/accounts/{id}/balances
# Returns: {}
```

**After fix:**
```bash
curl http://localhost:8001/api/db/accounts/acc_pj4bnt3ln8q6po9kva000/balances
# Returns: {"available": "78913.56", "ledger": "79039.63"}
```

## Prevention

The database file is already properly gitignored:
```gitignore
# .gitignore lines 13-15
*.db
python/*.db
python/devin_teller.db
```

## Production Note

This issue doesn't affect production because:
- Render uses PostgreSQL (not SQLite)
- DATABASE_URL environment variable is set
- No relative path issues with PostgreSQL connection strings

## Alternative Solutions Considered

1. **Change to absolute path:** Would break portability
2. **Change working directory:** Would break certificate paths (`--cert ../cert.pem`)
3. **Move database to root:** Would require updating start command
4. **Current solution:** Move database to where server expects it ✅

---

**Status:** Fixed. Database now in correct location for local development.
