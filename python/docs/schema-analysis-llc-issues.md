# Schema Analysis: LLC Data Issues

**Date:** 2025-10-05
**Status:** Pre-Removal Documentation
**Version:** v1.0-pre-llc-removal

---

## Executive Summary

The current database schema contains two independent systems with conflicting architectures:

1. **Teller Integration** (Core) - External banking data with immutable snapshots
2. **LLC Accounting** (Experimental) - Manual business accounting with mutable balances

The LLC system has caused serious issues in subsequent versions due to fundamental design flaws. This document catalogs those issues before removal.

---

## Critical Issues

### 1. Data Integrity: `current_balance` Drift

**Problem:** Balance stored as denormalized field, only recalculated during specific operations.

**Location:** `python/db.py:99` - `LLCAccount.current_balance`

**Failure Scenarios:**
- Direct database UPDATEs bypass recalculation
- Transaction deletions don't trigger balance updates
- Race conditions in concurrent requests

**Evidence:** No database triggers, constraints, or validation jobs exist.

**Impact:** Balance can become stale and incorrect, breaking financial reports.

---

### 2. No Reconciliation Between Systems

**Problem:** Teller data and LLC data are completely disconnected with zero cross-validation.

**Missing Components:**
- No bridge table linking Teller transactions → LLC transactions
- No reconciliation reports
- No detection of unrecorded bank activity

**Real-World Scenario:**
- Teller shows: $10,000 in business checking account
- LLC ledger totals: $25,000 across various accounts
- **No mechanism to verify they match**

**Impact:** Cannot detect missing transactions, double-entries, or accounting errors.

---

### 3. Missing Accounting Constraints

**Problem:** LLC transactions lack fundamental accounting validation.

**Location:** `python/db.py:106-115` - `LLCTransaction` model

**Invalid States Allowed:**
```python
# Both debit and credit can be > 0 (violates single-entry rule)
LLCTransaction(debit=100, credit=50)  # ✓ Allowed, ✗ Invalid

# Both can be zero (meaningless transaction)
LLCTransaction(debit=0, credit=0)  # ✓ Allowed, ✗ Invalid
```

**Missing Constraints:**
- `CHECK (debit > 0 OR credit > 0)` - Ensure transaction has value
- `CHECK (NOT (debit > 0 AND credit > 0))` - Enforce single-side entries

**Impact:** Garbage data can be inserted, corrupting financial records.

---

### 4. No Audit Trail

**Teller Side:** ✓ Immutable snapshots with timestamps
**LLC Side:** ✗ No transaction history

**Missing Features:**
- Created/modified timestamps on LLC transactions
- Soft deletes (deleted_at column)
- Audit log table for changes

**Impact:** Cannot track who changed what, when. No rollback capability.

---

### 5. No Double-Entry Accounting Enforcement

**Problem:** Transactions exist in isolation without offsetting entries.

**Current Schema:** Individual transactions
```python
LLCTransaction(account_id=1, debit=100, credit=0)  # Where did $100 come from?
```

**Missing:** Journal entry system with balanced debits/credits
```python
# Should require:
JournalEntry #123:
  - Debit: Cash $100
  - Credit: Revenue $100
# Constraint: SUM(debits) = SUM(credits) per entry
```

**Impact:** Cannot generate proper financial statements (Balance Sheet, Income Statement).

---

### 6. Financing Logic Limited to Single Loan

**Location:** `python/db.py:121` - `LLCFinancingTerms.account_id` has `unique=True`

**Problem:** Cannot model:
- Loan refinancing
- Multiple loans on same property
- Loan modifications

**Impact:** Schema becomes obsolete when business needs change.

---

### 7. Orphaned References

**Location:** `python/db.py:152` - `LLCRentTenant.base_id`

**Problem:** No foreign key constraint
```python
base_id = Column(Integer, nullable=False, unique=True)
# What table does this reference? Unknown.
```

**Impact:** Data integrity cannot be enforced, orphaned records possible.

---

### 8. Performance Issues

**Missing Indexes:**
```python
class LLCTransaction(Base):
    txn_date = Column(DateTime, nullable=False)  # ✗ No index
    # Query: "Get all 2024 transactions" → Full table scan
```

**Teller Has This Right:**
```python
# python/db.py:48
__table_args__ = (Index("ix_txn_acct_date", "account_id", "date"),)
```

**Impact:** Slow queries as data grows.

---

## Data Ownership & Migration Synchronization (DOMS)

### The Core Problem

Two independent systems with no coordination mechanism:

```
Teller Data (External)          LLC Data (Manual)
       ↓                              ↓
Pull from Teller API           User enters data
       ↓                              ↓
Store snapshots               Update current_balance
       ↓                              ↓
    Which is authoritative?
```

### Failure Scenarios

**1. Double-Entry of Transactions:**
- Bank deposit shows in Teller
- User also manually enters in LLC
- Revenue counted twice

**2. Migration Chaos:**
```python
# Attempt to import Teller → LLC
for teller_tx in transactions:
    # Which LLC account maps to this?
    # How prevent duplicates on re-import?
    # No mapping exists!
```

**3. Conflicting Balances:**
- Teller: Checking = $10,000
- LLC: Cash account = $8,500
- Which is correct? No way to know.

**4. Schema Conflicts:**
- Change Teller schema → No impact (external API)
- Change LLC schema → Requires Alembic migration
- Add link between them → **Both must change simultaneously**
- No coordination tool exists

---

## Frontend/DOM Issues

### Stale Data Display

**Problem:** Frontend shows cached `current_balance` without real-time updates.

**Location:** `static/js/app.js:679`
```javascript
accountsData[account.slug].balance = parseFloat(account.current_balance) || 0;
```

**Failure Scenario:**
- User has two browser tabs open
- Tab A adds LLC transaction
- Backend recalculates balance
- Tab B still shows old balance (no refresh)

### Race Conditions

**Problem:** Multiple simultaneous updates
```javascript
// Tab 1 POSTs transaction → triggers balance recalc
// Tab 2 POSTs transaction → triggers balance recalc
// Both calculate from scratch
// Last write wins - one transaction's effect lost
```

### Mixed Data Sources

**Problem:** Dashboard shows Teller + LLC data as equals
```javascript
// Dashboard renders:
// - Teller accounts (from /api/accounts)
// - LLC accounts (from /api/llc/accounts)
// User confusion: "Why don't these totals match?"
```

**Impact:** Users cannot distinguish external bank data from internal accounting.

---

## Architecture Comparison

| Aspect | Teller (Core) | LLC (Experimental) |
|--------|---------------|-------------------|
| Data Ownership | External (Teller API) | Internal (Manual Entry) |
| Transaction Model | Single `amount` field | Separate `debit`/`credit` |
| Balance Storage | Immutable snapshots | Mutable `current_balance` |
| ID Strategy | External string IDs | Auto-increment integers |
| Validation | API-enforced | Missing constraints |
| Audit Trail | Timestamp snapshots | None |
| Referential Integrity | Enforced | Partial/missing |

---

## Summary by Severity

### Critical (System-Breaking)
1. No Teller ↔ LLC reconciliation
2. `current_balance` drift
3. No double-entry enforcement

### High (Data Quality)
4. Missing accounting constraints
5. No audit trail

### Medium (Technical Debt)
6. Performance (missing indexes)
7. Single loan limitation
8. Orphaned references

---

## Conclusion

The LLC accounting system was added as an experimental feature but lacks fundamental:
- Data integrity constraints
- Reconciliation with Teller data
- Proper accounting principles (double-entry)
- Audit trails

These issues have caused serious problems in subsequent versions. The decision has been made to **remove all LLC functionality** and focus exclusively on the robust Teller integration.

---

**Next Steps:** See `docs/removal-plan-llc-code.md`
