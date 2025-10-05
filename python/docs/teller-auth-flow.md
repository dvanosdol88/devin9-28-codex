# Teller Authentication & Data Storage Flow

**Date:** 2025-10-05
**Version:** v2.0-teller-backend-only

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                                 │
│                        (http://localhost:8000)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 1. User visits
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         static/index.html                                │
│  - Loads Teller Connect JS widget                                       │
│  - Shows "Connect Your Bank" button                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 2. User clicks "Connect"
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      TELLER CONNECT WIDGET                               │
│                    (Hosted by Teller.io)                                │
│  - User selects their bank                                              │
│  - User enters credentials                                              │
│  - Bank authenticates user                                              │
│  - Teller generates access_token                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 3. Returns access_token
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         static/index.js                                  │
│  onSuccess(enrollment) {                                                │
│    const token = enrollment.accessToken;                                │
│    localStorage.setItem('teller:enrollment', JSON.stringify({           │
│      accessToken: token,                                                │
│      institution: enrollment.institution                                │
│    }));                                                                 │
│    window.location.href = '/dashboard.html';                            │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 4. Redirect to dashboard
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      static/dashboard.html                               │
│                      + static/js/app.js                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 5. Load account data
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      API Call: GET /api/accounts                         │
│  Headers: { Authorization: "Bearer <access_token>" }                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND: python/teller.py                             │
│                 AccountsResource.on_get()                               │
│                                                                          │
│  1. Extract token from Authorization header                             │
│  2. Call Teller API: GET https://api.teller.io/accounts                │
│     with Authorization: Basic base64(access_token:)                     │
│  3. Return account list to frontend                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Returns: [
                                    │   {id: "acc_xxx", name: "Checking", ...},
                                    │   {id: "acc_yyy", name: "Savings", ...}
                                    │ ]
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND: app.js                                  │
│  - Displays account cards                                               │
│  - User clicks "Refresh Balance" on an account                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 6. Fetch balance for account
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│            API Call: GET /api/accounts/{account_id}/balances            │
│  Headers: { Authorization: "Bearer <access_token>" }                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              BACKEND: AccountsResource.on_get_balances()                │
│                                                                          │
│  Step 1: Fetch from Teller API                                          │
│  ────────────────────────────────────────────────────────────────────  │
│  GET https://api.teller.io/accounts/{account_id}/balances              │
│  Authorization: Basic base64(access_token:)                             │
│                                                                          │
│  Returns: {                                                             │
│    available: "78913.56",                                               │
│    ledger: "79039.63"                                                   │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Step 2: Store to database
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND: Database Storage                             │
│                    (python/teller.py lines 98-111)                      │
│                                                                          │
│  1. GET https://api.teller.io/accounts/{account_id}                    │
│     - Fetch account metadata (name, type, institution)                  │
│                                                                          │
│  2. upsert_account(session, account_data)                               │
│     - Insert or update accounts table                                   │
│     - Saves: id, name, institution_id, type, subtype, last_four        │
│                                                                          │
│  3. add_balance_snapshot(session, account_id, balance_data)             │
│     - Insert into balance_snapshots table                               │
│     - Saves: account_id, available, ledger, as_of (timestamp), raw     │
│                                                                          │
│  4. session.commit()                                                    │
│     - Persist to sqlite:///devin_teller.db                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Step 3: Return to frontend
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND: app.js                                  │
│  - Updates balance display                                              │
│  - Shows: $78,913.56 available                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Breakdown

### 1. Frontend Components

**static/index.html**
- Teller Connect enrollment page
- Loads Teller widget from CDN
- Captures access token on success

**static/dashboard.html**
- Main application interface
- Displays account cards
- Shows balances and transactions

**static/js/app.js**
- API communication layer
- localStorage management for token
- UI updates

---

### 2. Token Storage

**Location:** Browser localStorage

**Key:** `teller:enrollment`

**Value:**
```json
{
  "accessToken": "test_token_abc123...",
  "institution": {
    "name": "Chase",
    "id": "chase"
  }
}
```

**Security Note:**
- Token stored in browser only (not server)
- Sent with every API request via Authorization header
- No server-side session management

---

### 3. Backend Endpoints

#### `/api/accounts` (GET)
- **Auth:** Required (Authorization header)
- **Flow:** Frontend → Backend → Teller API → Frontend
- **Storage:** None
- **Returns:** List of accounts

#### `/api/accounts/{id}/balances` (GET)
- **Auth:** Required
- **Flow:** Frontend → Backend → Teller API → **Database** → Frontend
- **Storage:**
  - accounts table (metadata)
  - balance_snapshots table (balance + timestamp)
- **Returns:** Current balance

#### `/api/accounts/{id}/transactions` (GET)
- **Auth:** Required
- **Flow:** Frontend → Backend → Teller API → **Database** → Frontend
- **Storage:**
  - accounts table (metadata)
  - transactions table (transaction list)
- **Returns:** Transaction list

#### `/api/db/accounts/{id}/balances` (GET)
- **Auth:** NOT required (reads from local DB)
- **Flow:** Frontend → Backend → **Database** → Frontend
- **Storage:** Read-only
- **Returns:** Latest cached balance snapshot

#### `/api/db/accounts/{id}/transactions` (GET)
- **Auth:** NOT required
- **Flow:** Frontend → Backend → **Database** → Frontend
- **Storage:** Read-only
- **Returns:** Cached transactions from DB

---

### 4. Database Schema

**File:** `python/devin_teller.db` (SQLite in development)

**Tables:**

```sql
-- Account metadata
accounts (
  id VARCHAR PRIMARY KEY,           -- Teller account ID
  name VARCHAR,                     -- "Checking", "Savings"
  institution_id VARCHAR,           -- "chase", "bofa"
  type VARCHAR,                     -- "depository", "credit"
  subtype VARCHAR,                  -- "checking", "savings"
  last_four VARCHAR,                -- "1234"
  created_at DATETIME,
  updated_at DATETIME
)

-- Balance history (time-series)
balance_snapshots (
  id INTEGER PRIMARY KEY,
  account_id VARCHAR FK → accounts(id),
  available NUMERIC(14,2),          -- Available balance
  ledger NUMERIC(14,2),             -- Ledger balance
  as_of DATETIME,                   -- Snapshot timestamp
  raw JSON,                         -- Full Teller response
  UNIQUE(account_id, as_of)         -- One snapshot per account per timestamp
)

-- Transaction history
transactions (
  id VARCHAR PRIMARY KEY,           -- Teller transaction ID
  account_id VARCHAR FK → accounts(id),
  date DATE,                        -- Transaction date
  description VARCHAR,              -- "Amazon.com", "Paycheck"
  amount NUMERIC(14,2),             -- Positive or negative
  raw JSON                          -- Full Teller response
)
```

**Indexes:**
- `balance_snapshots.account_id` (for fast lookups)
- `transactions.account_id` + `transactions.date` (composite)

---

### 5. Authentication Flow Detail

#### Token Extraction (Backend)

```python
# python/teller.py lines 228-243
def _extract_token(self, req):
    auth_header = req.get_header('Authorization')
    if not auth_header:
        return ''

    # Try Bearer token first
    if auth_header.startswith('Bearer '):
        return auth_header[7:]

    # Try Basic auth (base64 encoded)
    if auth_header.startswith('Basic '):
        try:
            decoded = base64.b64decode(auth_header[6:]).decode('utf-8')
            # Basic format is "username:password"
            # Teller uses "token:" so extract before colon
            return decoded.split(':')[0]
        except:
            pass

    # Return raw header as fallback
    return auth_header
```

#### Teller API Call

```python
# python/teller.py lines 67-73
def _get(self, path, params=None):
    headers = {}
    if self.access_token:
        # Teller uses Basic auth with token as username, empty password
        credentials = f'{self.access_token}:'
        encoded = base64.b64encode(credentials.encode()).decode()
        headers['Authorization'] = f'Basic {encoded}'

    if self.cert:
        # Development environment requires TLS client certificate
        return requests.get(
            f'{self._BASE_URL}{path}',
            headers=headers,
            cert=self.cert,
            params=params
        )
    else:
        # Sandbox environment (no cert required)
        return requests.get(
            f'{self._BASE_URL}{path}',
            headers=headers,
            params=params
        )
```

---

### 6. Data Persistence Flow

```
Frontend calls /api/accounts/{id}/balances
            ↓
Backend receives request with access_token
            ↓
Backend calls Teller API: GET /accounts/{id}/balances
            ↓
Teller returns: {available: "1000.00", ledger: "1000.00"}
            ↓
Backend calls Teller API: GET /accounts/{id}
            ↓
Teller returns: {id: "acc_xxx", name: "Checking", type: "depository", ...}
            ↓
Backend opens database session
            ↓
Backend calls upsert_account(session, account_data)
            ├─ SELECT * FROM accounts WHERE id = 'acc_xxx'
            ├─ If exists: UPDATE
            └─ If not exists: INSERT
            ↓
Backend calls add_balance_snapshot(session, account_id, balance_data)
            └─ INSERT INTO balance_snapshots (...)
            ↓
Backend calls session.commit()
            └─ Data written to python/devin_teller.db
            ↓
Backend returns balance to frontend
            ↓
Frontend displays updated balance
```

---

### 7. Environment Differences

| Aspect | Sandbox | Development | Production |
|--------|---------|-------------|------------|
| **Teller Environment** | sandbox | development | production |
| **TLS Cert Required** | ❌ No | ✅ Yes | ✅ Yes |
| **Database** | SQLite | SQLite | PostgreSQL |
| **Base URL** | api.teller.io | api.teller.io | api.teller.io |
| **Auth** | Basic (token:) | Basic (token:) | Basic (token:) |
| **Real Bank Data** | ❌ Test data | ✅ Real data | ✅ Real data |

**Current Setup:**
- Local: `--environment development` with certs
- Render: `--environment sandbox` (no certs on free tier)

---

### 8. Security Considerations

**Token Security:**
- ✅ Stored in browser localStorage (not cookies, prevents CSRF)
- ✅ Transmitted via HTTPS only
- ✅ Never logged in production
- ❌ Accessible via JavaScript (XSS risk)

**Database Security:**
- ✅ Access tokens NOT stored in database
- ✅ Only account metadata and balances stored
- ✅ SQLite file excluded from git (.gitignore)
- ✅ PostgreSQL requires SSL in production

**API Security:**
- ✅ CORS enabled for frontend
- ✅ Teller validates tokens server-side
- ❌ No rate limiting (consider adding)
- ❌ No request logging (could add for audit)

---

### 9. Error Handling

**Token Expired:**
```
Frontend → Backend → Teller API
                       ↓
                 401 Unauthorized
                       ↓
                  Backend returns 401
                       ↓
                  Frontend detects error
                       ↓
                  Redirects to /index.html
                       ↓
                  User re-enrolls
```

**Database Connection Error:**
```
Backend storage fails
       ↓
Exception logged
       ↓
Returns 500 to frontend
       ↓
Balance still returned (from Teller API)
       ↓
User sees balance, but it's not cached
```

**Teller API Down:**
```
Backend → Teller API timeout
              ↓
         Exception raised
              ↓
    Returns 500 to frontend
              ↓
    Frontend can fall back to cached endpoint:
    /api/db/accounts/{id}/balances
```

---

## Summary

**Auth Flow:**
1. User enrolls via Teller Connect widget
2. Widget returns access_token
3. Frontend stores token in localStorage
4. Frontend sends token with every API request
5. Backend proxies to Teller API with token
6. Backend stores responses in database
7. Future requests can use cached data

**Key Points:**
- Token never stored on server
- Database stores metadata + snapshots (not credentials)
- Dual endpoints: live (requires auth) vs cached (no auth)
- SQLite for dev, PostgreSQL for prod
- TLS certs required for development/production environments

---

**File References:**
- Frontend: `static/index.html`, `static/dashboard.html`, `static/js/app.js`
- Backend: `python/teller.py` (lines 21-244)
- Database: `python/db.py` (lines 1-84)
- Storage: `python/devin_teller.db` (SQLite)
