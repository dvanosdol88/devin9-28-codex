## ✅ Production-Ready with Render PostgreSQL

This application is configured for deployment on Render with PostgreSQL database integration. See [`docs/postgres.md`](docs/postgres.md) for comprehensive setup documentation and [`render.yaml`](render.yaml) for infrastructure configuration.

---

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
git clone https://github.com/dvanosdol88/devin9-28-codex.git
cd devin9-28-codex
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

### Production (Render PostgreSQL)

This application is configured for deployment on Render with PostgreSQL. See [`docs/postgres.md`](docs/postgres.md) for comprehensive setup instructions.

**Quick Start:**

1. Deploy using `render.yaml`:
   - Push your changes to GitHub
   - Connect your repository in Render Dashboard
   - Render will automatically detect `render.yaml` and provision the database and web service

2. For manual deployment or local production testing:
```bash
source .venv/bin/activate
export DATABASE_URL="postgresql://user:password@host/teller_storage?sslmode=require"
cd python
alembic upgrade head
python teller.py --environment production --cert cert.pem --cert-key private_key.pem
```

**Note**: Obtain TLS certificates from [Teller Developer Dashboard](https://teller.io/settings/certificates) for production (non-sandbox) environments.

## Docker Development Guide

This project provides two Docker Compose configurations for different development workflows:

### Option 1: Database Only (`docker-compose.yml`)

Use this when you want to run PostgreSQL in Docker but run the backend/frontend natively on your host machine. This is useful for faster development iterations and debugging.

**Setup:**

1) Copy environment file and configure credentials:
```bash
cp .env.example .env
# Edit .env to set secure POSTGRES_PASSWORD
```

2) Start PostgreSQL container:
```bash
docker compose up -d db
```

3) Export DATABASE_URL for host-run backend:
```bash
export $(grep -v '^\s*#' .env | xargs)
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB}"
```

4) Run Alembic migrations:
```bash
cd python
alembic upgrade head
cd ..
```

5) Start backend natively (sandbox; no certs required):
```bash
cd python
python teller.py --environment sandbox
```

6) Start frontend in another terminal:
```bash
./static.sh
```

**Verification:**
```bash
# Health check
curl -s http://localhost:8001/health

# Verify DB tables without local psql
docker exec -it teller-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\dt'
```

### Option 2: Full Stack (`docker-compose.dev.yml`)

Use this for running the entire application stack (database + API + tests) in containers. This is useful for CI/CD, testing, or ensuring environment consistency.

**Features:**
- PostgreSQL 16.4-alpine with health checks
- API service with automatic database connection
- Tests service for running pytest in containers
- All services use hardcoded dev credentials (dev/dev/devin)

**Setup:**

1) Build and start all services:
```bash
docker compose -f docker-compose.dev.yml up --build
```

2) Run tests only:
```bash
docker compose -f docker-compose.dev.yml up --build --exit-code-from tests tests
```

3) Run API only (with database):
```bash
docker compose -f docker-compose.dev.yml up --build db api
```

**Verification:**
```bash
# Health check (API must be running)
curl -s http://localhost:8001/health

# View logs
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml logs -f tests

# Clean up
docker compose -f docker-compose.dev.yml down -v
```

### Common Pitfalls & Solutions

#### 1. **SSL/TLS Mode for Production PostgreSQL**
- **Problem**: Production PostgreSQL (e.g., Render) requires SSL connections
- **Solution**: Always append `?sslmode=require` to DATABASE_URL for production:
  ```bash
  export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
  ```
- **Note**: Local Docker PostgreSQL doesn't require SSL

#### 2. **Host vs Container Networking**
- **Problem**: Backend can't connect to database with wrong hostname
- **Solution**:
  - **Host-run backend + Docker DB**: Use `localhost` or `127.0.0.1`
  - **Containerized backend + Docker DB**: Use service name `db`
  - The `docker-compose.dev.yml` correctly uses `db` for containerized backend

#### 3. **Health Check Failures**
- **Problem**: API service starts before database is ready
- **Solution**: Both compose files include health checks with proper wait conditions:
  ```yaml
  depends_on:
    db:
      condition: service_healthy
  ```
- **Debugging**: Check health status with:
  ```bash
  docker compose ps
  docker compose -f docker-compose.dev.yml ps
  ```

#### 4. **Environment Variable Loading**
- **Problem**: Environment variables not loaded correctly
- **Solutions**:
  - `docker-compose.yml` auto-loads `.env` file
  - For host-run backend: Use `export $(grep -v '^\s*#' .env | xargs)`
  - Verify with: `echo $DATABASE_URL`

#### 5. **Port Conflicts**
- **Problem**: Port 5432 or 8001 already in use
- **Solutions**:
  - Change port in `.env`: `POSTGRES_PORT=5433`
  - Stop conflicting service: `sudo systemctl stop postgresql`
  - Find process using port: `lsof -i :5432`

#### 6. **Stale Database State**
- **Problem**: Old database state causing issues
- **Solutions**:
  ```bash
  # For docker-compose.yml
  docker compose down -v  # Removes volumes
  docker compose up -d db
  
  # For docker-compose.dev.yml
  docker compose -f docker-compose.dev.yml down -v
  docker compose -f docker-compose.dev.yml up --build
  ```

#### 7. **Alembic "table already exists" Error**
- **Problem**: Tables created by `init_db()` conflict with Alembic migrations
- **Solution**: Drop all tables or use fresh database:
  ```bash
  # Docker method
  docker compose down -v
  docker compose up -d db
  cd python
  alembic upgrade head
  ```

### Troubleshooting

#### Database Connection Issues

1. **Check database is running:**
```bash
docker compose ps
docker logs teller-postgres
```

2. **Test connection directly:**
```bash
docker exec -it teller-postgres psql -U dev -d devin -c 'SELECT version();'
```

3. **Verify DATABASE_URL format:**
```bash
echo $DATABASE_URL
# Should be: postgresql://user:password@host:port/database
# Production should end with: ?sslmode=require
```

#### API Not Starting

1. **Check logs:**
```bash
docker compose -f docker-compose.dev.yml logs api
```

2. **Verify health check:**
```bash
docker compose -f docker-compose.dev.yml ps
# db should show "healthy"
```

3. **Rebuild containers:**
```bash
docker compose -f docker-compose.dev.yml up --build --force-recreate
```

#### Test Failures

1. **Run tests with verbose output:**
```bash
docker compose -f docker-compose.dev.yml run --rm tests pytest -v
```

2. **Check database state:**
```bash
docker exec -it teller-postgres psql -U dev -d devin -c '\dt'
```

3. **Clean and retry:**
```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up --build --exit-code-from tests tests
```

### Docker Images & Versions

- **PostgreSQL**: `postgres:16.4-alpine` (pinned for stability)
- **Python**: `python:3.12-slim` (from Dockerfile)
- All images are pinned to specific versions to prevent unexpected updates

### Production Notes

- For managed PostgreSQL (e.g., Render), ensure `?sslmode=require` in DATABASE_URL
- Run Alembic migrations before starting the API: `alembic upgrade head`
- Use TLS certificates for non-sandbox Teller environments
- Consider connection pooling for high-traffic scenarios

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

**Render Deployment (Recommended):**

The application is configured for automatic deployment via `render.yaml`:
- Database provisioning: Render PostgreSQL with SSL enabled
- Automatic migrations: `alembic upgrade head` runs on each deployment
- Environment variables: DATABASE_URL and other configs pre-configured

For detailed setup instructions, see [`docs/postgres.md`](docs/postgres.md).

**Manual Deployment:**

When deploying to other platforms:

1. Set `DATABASE_URL` to your production database (must include `?sslmode=require` for Render)
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
cd ~/repos/devin9-28-codex/python
python teller.py --environment sandbox
```
- Expect: "Database initialized successfully" and "Listening on port 8001"

2) Frontend: start static server
- Terminal B:
```
cd ~/repos/devin9-28-codex
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

### Render Deployment (Recommended)

This application is pre-configured for Render deployment via `render.yaml`:

1. **Push to GitHub**: Commit and push your changes to the `main` branch
2. **Connect Repository**: In Render Dashboard, connect your GitHub repository
3. **Auto-Deploy**: Render will automatically:
   - Detect `render.yaml` configuration
   - Provision PostgreSQL database
   - Run Alembic migrations (`alembic upgrade head`)
   - Start the web service

For detailed instructions, see [`docs/postgres.md`](docs/postgres.md).

### Manual Deployment

For other platforms:

1. Set up PostgreSQL database
2. Configure `DATABASE_URL` environment variable (include `?sslmode=require` for SSL)
3. Run migrations: `cd python && alembic upgrade head`
4. Deploy backend with `python teller.py --environment production`
5. Serve static files via web server (nginx, Apache, etc.)

**Troubleshooting:**
- Ensure Python 3.8+ is installed with requirements from `python/requirements.txt`
- Check DATABASE_URL format; defaults to `sqlite:///devin_teller.db` if not set
- For non-sandbox environments, pass `--cert` and `--cert-key` to backend
- Always run migrations before starting the application: `alembic upgrade head`

## Documentation

- **PostgreSQL Setup**: See [`docs/postgres.md`](docs/postgres.md) for comprehensive database configuration, Alembic migrations, and troubleshooting
- **Render Deployment**: See [`render.yaml`](render.yaml) for infrastructure-as-code configuration
- **Teller API**: Visit the [official Teller documentation](https://teller.io/docs) for API details

## Tests

Run the unit tests with pytest:

```
python3 -m venv .venv && . .venv/bin/activate
pip install -r python/requirements.txt
pytest
```
