# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack Teller Connect integration with persistent data storage. Python/Falcon backend with SQLAlchemy ORM, supporting SQLite (development) and PostgreSQL (production). Modern web frontend for viewing account data, balances, and transactions.

## Essential Commands

### Setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r python/requirements.txt
```

### Development (SQLite)
```bash
# Backend (Terminal 1)
cd python
python teller.py --environment sandbox

# Frontend (Terminal 2)
./static.sh

# Visit http://localhost:8000
```

### Testing
```bash
# Run all tests
pytest

# Run specific test file
pytest python/tests/test_accounts_auth.py

# Run with verbose output
pytest -v
```

### Docker Development

**Database only (native backend/frontend):**
```bash
# Start PostgreSQL
docker compose up -d db

# Set DATABASE_URL
export $(grep -v '^\s*#' .env | xargs)
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB}"

# Run migrations
cd python && alembic upgrade head

# Start backend
python teller.py --environment sandbox
```

**Full stack in containers:**
```bash
# All services
docker compose -f docker-compose.dev.yml up --build

# Tests only
docker compose -f docker-compose.dev.yml up --build --exit-code-from tests tests

# Clean up
docker compose -f docker-compose.dev.yml down -v
```

### Database Migrations (Alembic)

**All Alembic commands must be run from `python/` directory:**

```bash
cd python

# Check current version
alembic current

# Upgrade to latest
alembic upgrade head

# Generate migration after model changes in db.py
alembic revision --autogenerate -m "Description of changes"

# Downgrade one version
alembic downgrade -1
```

### Production Deployment (Render)
```bash
# Manual deployment with PostgreSQL
export DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
cd python
alembic upgrade head
python teller.py --environment production --cert cert.pem --cert-key private_key.pem
```

## Architecture

### Backend (`python/`)
- **teller.py**: Falcon API server with Teller integration
  - Live endpoints: `/api/accounts/{id}/balances`, `/api/accounts/{id}/transactions` (fetch from Teller + store)
  - Cached endpoints: `/api/db/accounts/{id}/balances`, `/api/db/accounts/{id}/transactions` (read from DB)
  - Health check: `/health`
- **db.py**: SQLAlchemy models and database utilities
  - Core models: `Account`, `BalanceSnapshot`, `Transaction`
  - LLC models: `LLCAccount`, `LLCTransaction`, `LLCFinancingTerms`, etc.
  - Database URL handling: Auto-converts `postgres://` to `postgresql://` for SQLAlchemy 2.x compatibility
  - Utilities: `init_db()`, `upsert_account()`, `add_balance_snapshot()`, `upsert_transactions()`

### Frontend (`static/`)
- **index.html**: Main page with Teller Connect enrollment
- **dashboard.html**: Account dashboard with transaction modals
- **js/app.js**: Frontend JavaScript with API integration
  - Auto-detects localhost vs production API endpoints
  - Manages access token in localStorage
  - LLC account integration for custom business logic

### Migrations (`python/alembic/`)
- **env.py**: Alembic configuration
  - Reads `DATABASE_URL` from environment (defaults to SQLite)
  - Auto-imports models from `db.py`
  - Handles `postgres://` → `postgresql://` URL scheme conversion
- **versions/**: Migration files (e.g., `e3cac1307792_initial_schema_baseline_from_existing_.py`)

### Configuration Files
- **render.yaml**: Infrastructure-as-code for Render deployment
  - Web service: API backend with automatic migrations
  - Static site: Frontend assets
  - PostgreSQL database with SSL enabled
- **docker-compose.yml**: Database-only setup for hybrid development
- **docker-compose.dev.yml**: Full containerized stack (DB + API + tests)
- **Dockerfile**: Python 3.12 slim image with health checks

## Key Patterns

### Database URL Handling
The codebase automatically handles Render's legacy `postgres://` URLs by converting to `postgresql://` for SQLAlchemy 2.x:
```python
# In db.py and alembic/env.py
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
```

### Authorization Flow
1. Frontend uses Teller Connect to enroll users
2. Access token stored in localStorage (`teller:enrollment`)
3. Token passed as `Authorization` header to live endpoints
4. Cached endpoints (`/api/db/*`) don't require auth (read from local DB)

### Data Persistence
1. Live endpoints fetch from Teller API and store in DB
2. Account metadata upserted before storing balances/transactions
3. Balances stored as snapshots with timestamps
4. Transactions upserted by ID (duplicates skipped)

### Migrations Workflow
1. Modify SQLAlchemy models in `db.py`
2. Generate migration: `cd python && alembic revision --autogenerate -m "Description"`
3. Review generated migration in `python/alembic/versions/`
4. Test: `alembic upgrade head`
5. Verify: `pytest`
6. Commit migration file with changes

## Common Pitfalls

### 1. SSL Mode for Production PostgreSQL
Production databases (e.g., Render) require SSL. Always append `?sslmode=require`:
```bash
export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

### 2. Alembic "table already exists" Error
Tables created by `init_db()` conflict with migrations. Solution:
```bash
docker compose down -v  # Drop all data
docker compose up -d db
cd python && alembic upgrade head
```

### 3. Host vs Container Networking
- Host-run backend + Docker DB: Use `localhost` in DATABASE_URL
- Containerized backend + Docker DB: Use `db` service name (already configured in `docker-compose.dev.yml`)

### 4. Running Alembic from Wrong Directory
All Alembic commands must be run from `python/` directory where `alembic.ini` lives:
```bash
cd python  # Required!
alembic upgrade head
```

## Environment Variables

- `DATABASE_URL`: Database connection string (defaults to `sqlite:///devin_teller.db`)
- `PORT`: Backend port (defaults to 8001)
- `LOG_LEVEL`: Logging level (defaults to INFO)
- `ENVIRONMENT`: Teller environment (sandbox/development/production)

## Testing Notes

- Tests use SQLite by default for isolation
- Test discovery: `pytest.ini` configures `testpaths = python/tests`
- Test files follow pattern: `test_*.py`
- For PostgreSQL testing: Set `DATABASE_URL` and run `python test_postgres.py`
- Conftest fixtures in `python/tests/conftest.py`

## Code Style

- Python: PEP 8, 4-space indent, snake_case functions/vars, PascalCase classes
- Line length: ≤79 characters (flake8 enforced)
- Import groups: stdlib, third-party, local
- Linting: `flake8 python` before PRs
- JS: const/let preferred, avoid globals

## Production Deployment

**Render (Automated):**
1. Push to GitHub `main` branch
2. Render auto-detects `render.yaml`
3. Provisions PostgreSQL + runs migrations + starts services

**Manual:**
1. Set `DATABASE_URL` with `?sslmode=require`
2. Run `cd python && alembic upgrade head`
3. Obtain TLS certs from Teller dashboard for non-sandbox
4. Start: `python teller.py --environment production --cert cert.pem --cert-key private_key.pem`

## File Structure Reference

```
├── python/
│   ├── teller.py              # Falcon API server
│   ├── db.py                  # SQLAlchemy models
│   ├── requirements.txt       # Python dependencies
│   ├── alembic/               # Database migrations
│   │   ├── env.py            # Alembic config
│   │   └── versions/         # Migration files
│   └── tests/                # pytest tests
├── static/
│   ├── index.html            # Main page
│   ├── dashboard.html        # Dashboard
│   └── js/app.js             # Frontend JS
├── docker-compose.yml        # DB-only setup
├── docker-compose.dev.yml    # Full stack setup
├── render.yaml               # Render IaC config
└── pytest.ini                # Test configuration
```
