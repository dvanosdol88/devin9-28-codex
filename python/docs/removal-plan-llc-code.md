# LLC Code Removal Plan

**Date:** 2025-10-05
**Status:** Pre-Removal Documentation
**Version:** v1.0-pre-llc-removal

---

## Overview

This document outlines the plan to remove all LLC accounting functionality from the Teller integration application. The Teller integration is the core feature; LLC accounting was experimental and has caused issues.

**Related Documentation:**
- Schema issues: `docs/schema-analysis-llc-issues.md`
- Code inventory: `docs/code-inventory-llc.md`

---

## Removal Strategy

### Principle: Clean Removal

- Create proper database migration (not manual SQL)
- Remove code in logical order (database → backend → frontend)
- Preserve removal history in git (archive branch + tags)
- Test after each major removal step
- Update all documentation

---

## Phase 1: Database Migration

### Create Alembic Migration

**Command:**
```bash
cd python
alembic revision -m "Remove LLC tables"
```

**Migration Content:**

Drop tables in reverse dependency order (children first, parents last):

```python
def upgrade():
    # Child tables (have foreign keys to parents)
    op.drop_table('llc_financing_breakdown')
    op.drop_table('llc_member_loans')
    op.drop_table('llc_rent_records')
    op.drop_table('llc_rent_totals')

    # Parent tables (referenced by children)
    op.drop_table('llc_financing_terms')
    op.drop_table('llc_rent_months')
    op.drop_table('llc_account_transactions')
    op.drop_table('llc_rent_tenants')
    op.drop_table('llc_accounts')
    op.drop_table('llc_members')

def downgrade():
    # Reverse operation (recreate tables)
    # Copy from llc_tables_migration.py if rollback needed
```

**Testing:**
```bash
# Apply migration
alembic upgrade head

# Verify tables dropped
sqlite3 devin_teller.db ".tables"  # Should show only Teller tables

# Test rollback capability
alembic downgrade -1
alembic upgrade head
```

---

## Phase 2: Backend Code Removal

### File: `python/teller.py`

**Remove Resource Classes:**
- Lines 246-440: `LLCAccountsResource` class (~195 lines)
- Lines 442-550: `LLCRentResource` class (~108 lines)

**Remove Instantiation:**
- Lines 593-594: Delete resource object creation

**Remove Route Definitions:**
- Lines 618-624: Remove all `/api/llc/*` routes

**Clean Imports:**
- Search for any `from db import LLC*` statements
- Remove if no longer used

**Result:** ~300 lines removed from teller.py

---

## Phase 3: Database Models Removal

### File: `python/db.py`

**Remove Model Classes:**
- Lines 86-89: `LLCMember`
- Lines 92-103: `LLCAccount`
- Lines 106-115: `LLCTransaction`
- Lines 118-128: `LLCFinancingTerms`
- Lines 131-137: `LLCFinancingBreakdown`
- Lines 140-146: `LLCMemberLoan`
- Lines 149-155: `LLCRentTenant`
- Lines 158-164: `LLCRentMonth`
- Lines 167-175: `LLCRentRecord`
- Lines 178-182: `LLCRentTotal`

**Keep Teller Models:**
- `Account`
- `BalanceSnapshot`
- `Transaction`

**Keep Infrastructure:**
- Database URL handling
- `init_db()` function
- Helper functions for Teller data

**Result:** ~100 lines removed from db.py

---

## Phase 4: Frontend Code Removal

### File: `static/js/app.js`

**Remove Functions:**
- LLC account fetching logic
- LLC data rendering functions
- LLC transaction handlers

**Search Patterns:**
- `llc` (case-insensitive)
- `/api/llc/`
- Any references to LLC accounts in data structures

### File: `static/dashboard.html`

**Remove UI Elements:**
- LLC account sections
- LLC transaction modals
- LLC-specific buttons/forms

### File: `static/index.html`

**Remove References:**
- Search for `llc` (case-insensitive)
- Remove any LLC-related documentation or links

---

## Phase 5: Testing

### Backend Tests
```bash
# Run full test suite
pytest

# Verify Teller tests pass
pytest python/tests/test_accounts_auth.py -v

# Check for import errors
python -c "from db import Account, Transaction, BalanceSnapshot; print('OK')"
```

### Manual Testing
```bash
# Start server
source .venv/bin/activate && cd python && python teller.py --environment sandbox

# Test endpoints (should work):
curl http://localhost:8001/health
curl http://localhost:8001/api/accounts -H "Authorization: Bearer TOKEN"

# Test removed endpoints (should 404):
curl http://localhost:8001/api/llc/accounts
```

### Frontend Testing
- Visit http://localhost:8000
- Enroll via Teller Connect
- View dashboard
- Verify Teller accounts display correctly
- Verify no console errors related to LLC

---

## Phase 6: Documentation Updates

### Files to Update

**`CLAUDE.md`:**
- Remove LLC references from architecture section
- Remove LLC endpoints from essential commands
- Update database model list

**`README.md` (if exists):**
- Remove LLC feature descriptions
- Update screenshots if they show LLC features

**Create New Doc:**
- `docs/llc-removal-complete.md` - Summary of what was removed

---

## Phase 7: Git Workflow

### Step 1: Create Archive Branch
```bash
git checkout -b archive/llc-features
git push -u origin archive/llc-features
git checkout main
```

### Step 2: Tag Current State
```bash
git tag -a v1.0-pre-llc-removal -m "Complete state before LLC removal"
git push origin v1.0-pre-llc-removal
```

### Step 3: Make Changes
- Apply all removal steps
- Commit incrementally:
  ```bash
  git add python/alembic/versions/XXXXX_remove_llc_tables.py
  git commit -m "feat: Add migration to remove LLC tables"

  git add python/teller.py
  git commit -m "refactor: Remove LLC resource classes from API"

  git add python/db.py
  git commit -m "refactor: Remove LLC database models"

  git add static/
  git commit -m "refactor: Remove LLC functionality from frontend"

  git add docs/ CLAUDE.md
  git commit -m "docs: Update documentation after LLC removal"
  ```

### Step 4: Tag Final State
```bash
git tag -a v2.0-teller-only -m "Clean Teller-only version, all LLC code removed"
git push origin main --tags
```

---

## Phase 8: Deployment

### Render Deployment

**Automatic Process:**
1. Push to `main` triggers auto-deploy
2. Render runs: `cd python && alembic upgrade head`
3. Migration drops LLC tables
4. Server starts with cleaned code

**Monitoring:**
```bash
render deploys list devin-teller-api -o json
render logs devin-teller-api
```

**Verification:**
```bash
# Check health
curl https://devin-teller-api.onrender.com/health

# Test Teller endpoint
curl https://devin-teller-api.onrender.com/api/accounts \
  -H "Authorization: Bearer TOKEN"

# Verify LLC removed (should 404)
curl https://devin-teller-api.onrender.com/api/llc/accounts
```

---

## Rollback Plan

### If Issues Arise

**Code Rollback:**
```bash
git revert <commit-hash>
git push origin main
```

**Database Rollback:**
```bash
cd python
alembic downgrade -1  # Undo LLC table removal
```

**Complete Rollback:**
```bash
git checkout v1.0-pre-llc-removal
git checkout -b hotfix/restore-llc
# Fix issues, then re-attempt removal
```

**Archive Branch:**
```bash
# Restore from archive
git checkout archive/llc-features
git checkout -b restore-llc
git merge main
```

---

## Success Criteria

### Code Quality
- ✅ All Teller tests pass
- ✅ No import errors
- ✅ No dead code references to LLC
- ✅ Linting passes (flake8)

### Functionality
- ✅ Teller Connect enrollment works
- ✅ Account listing works
- ✅ Balance fetching works
- ✅ Transaction fetching works
- ✅ Dashboard displays correctly

### Documentation
- ✅ CLAUDE.md updated
- ✅ README updated (if exists)
- ✅ Removal documented in `llc-removal-complete.md`

### Deployment
- ✅ Production migration succeeds
- ✅ Production health check passes
- ✅ No errors in production logs

---

## Timeline Estimate

| Phase | Estimated Time |
|-------|---------------|
| 1. Database Migration | 15 minutes |
| 2. Backend Removal | 30 minutes |
| 3. Models Removal | 15 minutes |
| 4. Frontend Removal | 45 minutes |
| 5. Testing | 30 minutes |
| 6. Documentation | 30 minutes |
| 7. Git Workflow | 15 minutes |
| 8. Deployment | 20 minutes |
| **Total** | **~3 hours** |

---

## Risk Assessment

### Low Risk
- Teller models unchanged
- Core API endpoints unchanged
- Database migration is reversible

### Medium Risk
- Frontend may have hidden LLC dependencies
- Third-party scripts might call LLC endpoints

### Mitigation
- Incremental commits (easy to identify breaking change)
- Archive branch preserves original code
- Local testing before production deploy
- Ability to rollback migration

---

**Next Steps:** See `docs/code-inventory-llc.md` for detailed file locations.
