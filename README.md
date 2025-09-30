## Docker image CI (build-only)

A lightweight CI job builds the API Docker image to detect Dockerfile regressions. It does not push images.

- Triggered in GitHub Actions alongside existing tests.
- Uses docker/setup-buildx-action and docker/build-push-action with push=false.
- No impact on Render deployment or production config.


# Teller Storage Application

## Introduction

This repository contains a full-stack Teller Connect integration with persistent data storage capabilities. The application features a Python backend with SQLAlchemy ORM for data persistence, supporting both SQLite (development) and PostgreSQL (production) databases. It includes a modern web frontend with dashboard functionality for viewing stored account data.

## Features

- **Teller Connect Integration**: Complete enrollment flow with bank account linking
- **Persistent Data Storage**: SQLAlchemy-based storage for accounts, balances, and transactions
- **Dual Database Support**: SQLite for development, PostgreSQL for production
- **Dashboard Interface**: Modern UI for viewing cached account data with transaction modals
- **Live & Cached APIs**: Real-time Teller API calls plus cached data endpoints
- **Production Ready**: PostgreSQL migration support for deployment

## Architecture

### Database Models
- **Account**: Bank account information (name, institution, type, subtype)
- **BalanceSnapshot**: Account balance data with timestamps
- **Transaction**: Transaction history with full metadata

### API Endpoints
- **Live Endpoints**: `/api/accounts/{id}/balances`, `/api/accounts/{id}/transactions` - Fetch from Teller API and store
- **Cached Endpoints**: `/api/db/accounts/{id}/balances`, `/api/db/accounts/{id}/transactions` - Retrieve stored data
- **Health Check**: `/health` - Backend status verification

## Setup

### Prerequisites
- Python 3.8+
- PostgreSQL (for production) or SQLite (for development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/dvanosdol88/devin_teller_storage.git
cd devin_teller_storage
```

2. Set up Python virtual environment and install dependencies:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r python/requirements.txt
```

3. Configure your Teller application ID in `static/index.js`:
```javascript
const APPLICATION_ID = 'your_teller_app_id_here';
const ENVIRONMENT = 'sandbox'; // or 'development'/'production'
```

### Development (SQLite)

1. Activate virtual environment (if not already active):
```bash
source .venv/bin/activate
```

2. Start the backend server:
```bash
cd python
python teller.py --environment sandbox
```

3. Start the frontend server (in a new terminal):
```bash
./static.sh
```

4. Visit [localhost:8000](http://localhost:8000) to use the application.

### Production (PostgreSQL)

1. Set up PostgreSQL database:
```bash
sudo -u postgres createdb teller_storage
sudo -u postgres createuser teller_user
sudo -u postgres psql -c "ALTER USER teller_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE teller_storage TO teller_user;"
```

2. Obtain TLS certificates from [Teller Developer Dashboard](https://teller.io/settings/certificates) and place them in the `python/` directory as `cert.pem` and `private_key.pem`

3. Start with PostgreSQL configuration:
```bash
source .venv/bin/activate
export DATABASE_URL="postgresql://teller_user:your_password@localhost/teller_storage"
cd python
python teller.py --environment production --cert cert.pem --cert-key private_key.pem
```

Or use the provided script (update with your certificate paths):
```bash
./start_postgres_backend.sh
```

## Run PostgreSQL via Docker (Dev)

1) Copy environment file and set a non-default password:
```
cp .env.example .env
```

2) Start Postgres (Compose auto-loads .env):
```
docker compose up -d db
```

3) Export DATABASE_URL for the host-run backend:
```
export $(grep -v '^\s*#' .env | xargs)
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}/${POSTGRES_DB}"
```

4) Start the backend natively (sandbox; no certs required):
```
cd python
python teller.py --environment sandbox
```

5) Health check:
```
curl -s http://localhost:8001/health
```

6) Verify DB tables without local psql:
```
docker exec -it teller-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\dt'
```

Notes:
- Use postgres:16.4-alpine image (pinned) in docker-compose.yml.
- For production on Render (managed PostgreSQL), ensure TLS:
  - Append `?sslmode=require` to the DATABASE_URL if not provided by the platform.
- Keep POSTGRES_HOST=localhost for host-run backend. If you later containerize the backend, switch host to `db`.

## Testing

### PostgreSQL Migration Test
Run the comprehensive test script to verify PostgreSQL functionality:
```bash
source .venv/bin/activate
python test_postgres.py
```

### Application Testing
1. Start both backend and frontend servers (see Development or Production setup above)
2. Navigate to [localhost:8000](http://localhost:8000)
3. Click **Connect** to start Teller Connect enrollment
4. Use sandbox credentials to test the flow
5. Verify accounts appear on the dashboard
6. Click accounts to view transaction modals
7. Test API endpoints:
   - Health check: `curl http://localhost:8001/health`
   - Cached balances: `curl http://localhost:8001/api/db/accounts/{account_id}/balances`

## Usage

### Enrollment Flow
1. Click **Connect** to start Teller Connect enrollment
2. Select your bank and enter credentials (use sandbox for testing)
3. Complete the enrollment process
4. View your accounts on the dashboard

### Dashboard Features
- **Account Overview**: View all connected accounts with current balances
- **Transaction History**: Click any account to view transaction details in a modal
- **Real-time Data**: Balances and transactions are fetched and stored automatically
- **Cached Performance**: Dashboard loads from stored data for fast performance

### API Integration
- **Live Data**: Use `/api/accounts/{id}/balances` and `/api/accounts/{id}/transactions` for real-time Teller API calls
- **Cached Data**: Use `/api/db/accounts/{id}/balances` and `/api/db/accounts/{id}/transactions` for stored data
- **Health Monitoring**: Use `/health` endpoint to verify backend status

The *User* specified on the right-hand side is the Teller identifier associated to the user whose accounts were enrolled. The *Access Token* authorizes your Teller application to access the user's account data. For more information you can read our online [documentation](https://teller.io/docs).

## Storage and Cached Endpoints

This demo persists selected Teller responses to a database and exposes cached read endpoints.

- Backend: python/teller.py initializes the DB on startup via `init_db()`.
- ORM/DB: python/db.py (SQLAlchemy) with models Account, BalanceSnapshot, Transaction.
- Database URL: set by `DATABASE_URL`; defaults to `sqlite:///devin_teller.db` in the repo root for local development.
- Ports:
  - Backend API: `:8001` (configurable via `PORT`)
  - Frontend: `:8000` (served by `./static.sh`)

### What gets persisted

- GET /api/accounts/{account_id}/balances
  - Persists a BalanceSnapshot row with available, ledger, timestamp, and the full raw JSON.

- GET /api/accounts/{account_id}/transactions[?count=N]
  - Upserts Transaction rows (id, date, description, amount, and raw JSON).

In both cases, account metadata is upserted before writing snapshots/transactions.

### Cached read endpoints

These endpoints read from the local database (no external Teller call):

- Latest balance snapshot for an account:
  - GET `/api/db/accounts/{account_id}/balances`
  - Response: most recent persisted balance JSON or `{}` if none exists.

- Recent cached transactions for an account:
  - GET `/api/db/accounts/{account_id}/transactions?limit=100`
  - Query param: `limit` (default 100)
  - Response: array of transaction JSONs or `[]` if none exist.

### Example usage (after making live calls)

1) Populate the cache via live endpoints:
- GET `http://localhost:8001/api/accounts/{account_id}/balances`
- GET `http://localhost:8001/api/accounts/{account_id}/transactions?count=30`

2) Read from the cache:
- GET `http://localhost:8001/api/db/accounts/{account_id}/balances`
- GET `http://localhost:8001/api/db/accounts/{account_id}/transactions?limit=30`

Example curl (replace placeholders):

```
# Health check
curl -s http://localhost:8001/health

# Live (requires Authorization with access token; Basic or raw token supported)
curl -s -H "Authorization: Basic <base64(access_token:unused)>" \
  "http://localhost:8001/api/accounts/{ACCOUNT_ID}/balances"

# Cached (no auth; local DB read)
curl -s "http://localhost:8001/api/db/accounts/{ACCOUNT_ID}/balances"
curl -s "http://localhost:8001/api/db/accounts/{ACCOUNT_ID}/transactions?limit=30"
```

Notes:
- Frontend sets the Authorization automatically after enrollment.
- Non-sandbox environments require `--cert` and `--cert-key` when starting the backend; sandbox does not.

## Development

### Database Initialization
The backend automatically creates all required tables on startup via `init_db()`. No manual schema setup required.

### Database Migrations with Alembic

This project uses [Alembic](https://alembic.sqlalchemy.org/) for database schema migrations. Alembic tracks database schema changes over time, making it safe to evolve your database structure across environments.

#### Initial Setup
Alembic is already configured in `python/alembic/` with the baseline schema migration. The configuration:
- Reads `DATABASE_URL` from environment (falls back to `sqlite:///devin_teller.db`)
- Imports models from `python/db.py` (Account, BalanceSnapshot, Transaction)
- Migration files are stored in `python/alembic/versions/`

#### Common Alembic Commands

Run these commands from the `python/` directory:

```bash
cd python

# View current migration version
alembic current

# View migration history
alembic history --verbose

# Upgrade to latest version
alembic upgrade head

# Upgrade to specific version
alembic upgrade <revision_id>

# Downgrade one version
alembic downgrade -1

# Downgrade to specific version
alembic downgrade <revision_id>

# Generate new migration after model changes
alembic revision --autogenerate -m "Description of changes"

# Create empty migration (for data migrations)
alembic revision -m "Description"
```

#### Workflow for Schema Changes

1. **Modify SQLAlchemy models** in `python/db.py`
2. **Generate migration**:
   ```bash
   cd python
   alembic revision --autogenerate -m "Add new column to Account"
   ```
3. **Review generated migration** in `python/alembic/versions/`
4. **Test migration**:
   ```bash
   alembic upgrade head
   ```
5. **Verify tests still pass**:
   ```bash
   cd ..
   pytest -q
   ```
6. **Commit migration file** with your changes

#### Production Deployment with Migrations

When deploying to production (e.g., Render PostgreSQL):

1. Set `DATABASE_URL` to your production database
2. Run migrations before starting the app:
   ```bash
   cd python
   alembic upgrade head
   python teller.py --environment production --cert cert.pem --cert-key private_key.pem
   ```

#### Troubleshooting

- **"table already exists" error**: Your database might already have tables created by `init_db()`. For a fresh start, drop all tables or use a new database, then run `alembic upgrade head`.
- **Migration conflicts**: If working in a team, coordinate migrations to avoid conflicts. Always pull latest changes before creating new migrations.
- **Schema drift**: Use `alembic check` (requires Alembic 1.13+) to detect differences between models and database.

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (optional, defaults to SQLite)
- `TELLER_APPLICATION_ID`: Your Teller application ID
- `TELLER_ENVIRONMENT`: Target environment (sandbox/development/production)

### File Structure
```
├── python/
│   ├── teller.py          # Backend server with API endpoints
│   └── db.py              # SQLAlchemy models and database configuration
├── static/
│   ├── index.html         # Main application page
│   ├── dashboard.html     # Dashboard interface
│   ├── index.js           # Frontend JavaScript
│   └── index.css          # Styling
├── test_postgres.py       # PostgreSQL migration test script
├── start_postgres_backend.sh  # PostgreSQL startup script
└── static.sh              # Frontend server script
```

## Local Verification Checklist

These steps verify that the app works end-to-end after changes.

1) Backend: start API server (sandbox; no certs required)
- Terminal A:
```
cd ~/repos/devin_teller_storage/python
python teller.py --environment sandbox
```
- Expect: "Database initialized successfully" and "Listening on port 8001"

2) Frontend: start static server
- Terminal B:
```
cd ~/repos/devin_teller_storage
./static.sh
```
- Visit: http://localhost:8000

3) Frontend: Connect and enroll a user
- Click Connect
- Complete sandbox flow
- Expect: Accounts listed; Access Token auto-set in the UI

4) Populate cache via live endpoints
- For a chosen {ACCOUNT_ID} from the UI:
```
# balances
curl -s -H "Authorization: <ACCESS_TOKEN>" \
  "http://localhost:8001/api/accounts/{ACCOUNT_ID}/balances" | jq .

# transactions (30)
curl -s -H "Authorization: <ACCESS_TOKEN>" \
  "http://localhost:8001/api/accounts/{ACCOUNT_ID}/transactions?count=30" | jq .
```
- Expect: JSON payloads returned; backend logs show no errors

5) Read cached data (no auth required)
```
curl -s "http://localhost:8001/api/db/accounts/{ACCOUNT_ID}/balances" | jq .
curl -s "http://localhost:8001/api/db/accounts/{ACCOUNT_ID}/transactions?limit=30" | jq .
```
- Expect: Most recent balance JSON and array of transactions

6) Health check
```
curl -s http://localhost:8001/health | jq .
```
- Expect: {"status":"ok"}

## Deployment

For production deployment:
1. Set up PostgreSQL database
2. Configure `DATABASE_URL` environment variable
3. Deploy backend with `python teller.py --environment production`
4. Serve static files via web server (nginx, Apache, etc.)

Troubleshooting:
- Ensure Python 3 is installed and requirements in python/requirements.txt are installed if needed
- Check DATABASE_URL if using Postgres; otherwise defaults to sqlite:///devin_teller.db
- For non-sandbox environments, pass --cert and --cert-key to backend

## Documentation

For more information about Teller's API, visit the [official documentation](https://teller.io/docs).

## Tests

Run the unit tests with pytest:

```
python3 -m venv .venv && . .venv/bin/activate
pip install -r python/requirements.txt
pytest
```
