# LLC Code Inventory

**Date:** 2025-10-05
**Status:** Pre-Removal Documentation
**Version:** v1.0-pre-llc-removal

---

## Overview

Complete inventory of all LLC-related code to be removed. This document provides exact file paths and line numbers for surgical removal.

---

## Backend: `python/teller.py` (636 lines total)

### Resource Classes

**`LLCAccountsResource` Class**
- **Lines:** 246-440 (~195 lines)
- **Methods:**
  - `on_get()` - Retrieve all LLC accounts
  - `on_post()` - Create/update LLC account
  - `on_get_transactions()` - Get transactions for account
  - `on_post_transactions_bulk()` - Bulk update transactions

**`LLCRentResource` Class**
- **Lines:** 442-550 (~108 lines)
- **Methods:**
  - `on_get_tenants()` - Get all tenants
  - `on_get_month()` - Get rent data for specific month
  - `on_post_month()` - Update rent data for month

### Resource Instantiation

**Lines 593-594:**
```python
llc_accounts = LLCAccountsResource()
llc_rent = LLCRentResource()
```

### Route Definitions

**Lines 618-624:**
```python
app.add_route('/api/llc/accounts', llc_accounts)
app.add_route('/api/llc/accounts/{account_id}/transactions', llc_accounts,
              suffix='transactions')
app.add_route('/api/llc/accounts/{account_id}/transactions/bulk', llc_accounts,
              suffix='transactions_bulk')
app.add_route('/api/llc/rent/tenants', llc_rent, suffix='tenants')
app.add_route('/api/llc/rent/{month_str}', llc_rent, suffix='month')
```

### API Endpoints to Remove

1. `GET /api/llc/accounts` - List all LLC accounts
2. `POST /api/llc/accounts` - Create/update LLC account
3. `GET /api/llc/accounts/{id}/transactions` - Get account transactions
4. `POST /api/llc/accounts/{id}/transactions/bulk` - Bulk update transactions
5. `GET /api/llc/rent/tenants` - List tenants
6. `GET /api/llc/rent/{month}` - Get rent data for month
7. `POST /api/llc/rent/{month}` - Update rent data

**Total Lines to Remove:** ~310 lines

---

## Database Models: `python/db.py` (183 lines total)

### Model Classes

**`LLCMember`**
- **Lines:** 86-89
- **Table:** `llc_members`
- **Fields:** member_id (PK), name

**`LLCAccount`**
- **Lines:** 92-103
- **Table:** `llc_accounts`
- **Fields:** account_id (PK), slug, name, subtitle, account_type, current_balance, created_at, updated_at
- **Relationships:** transactions, financing_terms

**`LLCTransaction`**
- **Lines:** 106-115
- **Table:** `llc_account_transactions`
- **Fields:** transaction_id (PK), account_id (FK), txn_date, description, debit, credit, created_at
- **Relationships:** account

**`LLCFinancingTerms`**
- **Lines:** 118-128
- **Table:** `llc_financing_terms`
- **Fields:** financing_id (PK), account_id (FK), principal, interest_rate, term_years, created_at
- **Relationships:** account, breakdowns, member_loans

**`LLCFinancingBreakdown`**
- **Lines:** 131-137
- **Table:** `llc_financing_breakdown`
- **Fields:** financing_breakdown_id (PK), financing_id (FK), label, amount
- **Relationships:** financing

**`LLCMemberLoan`**
- **Lines:** 140-146
- **Table:** `llc_member_loans`
- **Fields:** member_loan_id (PK), financing_id (FK), member_id (FK), amount
- **Relationships:** financing

**`LLCRentTenant`**
- **Lines:** 149-155
- **Table:** `llc_rent_tenants`
- **Fields:** tenant_id (PK), base_id, floor, renter_name, created_at

**`LLCRentMonth`**
- **Lines:** 158-164
- **Table:** `llc_rent_months`
- **Fields:** rent_month_id (PK), month_start, created_at
- **Relationships:** records, total

**`LLCRentRecord`**
- **Lines:** 167-175
- **Table:** `llc_rent_records`
- **Fields:** rent_record_id (PK), rent_month_id (FK), tenant_id (FK), monthly_rent, amount_due, amount_received
- **Relationships:** month

**`LLCRentTotal`**
- **Lines:** 178-182
- **Table:** `llc_rent_totals`
- **Fields:** rent_month_id (PK/FK), total_monthly_rent
- **Relationships:** month

**Total Lines to Remove:** ~97 lines

---

## Database Tables (10 total)

### Drop Order (Reverse Dependency)

**Child Tables (have FKs, drop first):**
1. `llc_financing_breakdown` → references `llc_financing_terms`
2. `llc_member_loans` → references `llc_financing_terms`, `llc_members`
3. `llc_rent_records` → references `llc_rent_months`, `llc_rent_tenants`
4. `llc_rent_totals` → references `llc_rent_months`

**Parent Tables (referenced by others, drop second):**
5. `llc_financing_terms` → references `llc_accounts`
6. `llc_rent_months` → standalone parent
7. `llc_account_transactions` → references `llc_accounts`
8. `llc_rent_tenants` → standalone parent

**Root Tables (no FKs, drop last):**
9. `llc_accounts` → root table
10. `llc_members` → root table

---

## Database Migrations

### Migration Files to Review

**`python/alembic/versions/llc_tables_migration.py`**
- Contains LLC table creation logic
- Will be used as reference for `downgrade()` in removal migration
- **Note:** This file can remain (historical record) or be deleted

### New Migration to Create

**Filename:** `python/alembic/versions/{revision}_remove_llc_tables.py`
- Drop all 10 LLC tables in correct order
- Provide `downgrade()` for rollback capability

---

## Frontend: `static/js/app.js`

### Search Patterns Found

**LLC References:**
- Line 677: `llcAccounts.forEach(account => {`
- Line 679: `accountsData[account.slug].balance = parseFloat(account.current_balance) || 0;`
- Line 681: `if (account.transactions && account.transactions.length > 0) {`
- Line 950: `subtitle: accountsData[accountId].subtitle,`
- Line 951: `account_type: accountsData[accountId].type,`
- Line 952: `current_balance: accountsData[accountId].balance,`
- Line 953: `transactions: newTransactions`

**API Calls:**
- Searches for `/api/llc/` endpoints
- LLC account fetching logic
- LLC data rendering functions

**Estimated Removal:** ~50-100 lines (exact count requires detailed analysis)

---

## Frontend: `static/dashboard.html`

### Search Patterns

**LLC UI Elements:**
- Search for "llc" (case-insensitive)
- LLC account display sections
- LLC transaction modals
- LLC-specific forms/buttons

**Estimated Removal:** ~30-50 lines

---

## Frontend: `static/index.html`

### Search Patterns

**LLC References:**
- Search for "llc" (case-insensitive)
- Documentation mentioning LLC features
- Links to LLC functionality

**Estimated Removal:** ~5-10 lines (minimal)

---

## Testing Files

### May Need Updates

**`python/tests/conftest.py`**
- Check for LLC fixtures
- Remove if present

**`python/tests/test_*.py`**
- Search for LLC test cases
- Remove if present

---

## Documentation Files

### Files to Update

**`CLAUDE.md`**
- Sections mentioning LLC architecture
- LLC endpoints in command examples
- LLC database models

**`README.md` (if exists)**
- LLC feature descriptions
- Screenshots showing LLC UI

**`docs/` directory**
- Any LLC-specific guides

---

## Configuration Files

### Files to Check (likely no changes)

**`render.yaml`**
- No LLC-specific configuration found

**`docker-compose.yml`**
- No LLC-specific configuration found

**`requirements.txt`**
- No LLC-specific dependencies

---

## Summary Statistics

| Component | Files | Lines | Tables | Endpoints |
|-----------|-------|-------|--------|-----------|
| Backend API | 1 | ~310 | - | 7 |
| Database Models | 1 | ~97 | 10 | - |
| Frontend JS | 1 | ~50-100 | - | - |
| Frontend HTML | 2 | ~35-60 | - | - |
| Migrations | 1 new | ~50 | - | - |
| Documentation | 2+ | ~100 | - | - |
| **Total** | **7-8** | **~640-720** | **10** | **7** |

---

## Preservation Strategy

### Archive Branch: `archive/llc-features`

**Contains:**
- Complete working LLC code
- All LLC migrations
- LLC documentation
- LLC frontend

**Purpose:**
- Reference for future projects
- Rollback capability if needed
- Historical record

**Command:**
```bash
git checkout -b archive/llc-features
git push -u origin archive/llc-features
```

---

## Verification Checklist

After removal, verify no references remain:

**Backend:**
```bash
grep -r "LLC" python/teller.py
grep -r "llc" python/db.py
grep -r "llc_" python/
```

**Frontend:**
```bash
grep -ri "llc" static/
```

**Documentation:**
```bash
grep -ri "llc" docs/ CLAUDE.md README.md
```

**Expected Result:** No matches (except in this inventory file and removal documentation)

---

**Next Phase:** Create archive branch and tag current state.
