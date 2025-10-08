# Testing Guide for Devin/Codex Branches

This guide provides step-by-step instructions for testing both version branches in isolation without confusion or conflicts.

## Overview

**Codex Branch** (`version/codex`):
- Virtual environment: `.venv-codex`
- Database file: `dt_codex.db`
- Port: `8001`

**Devin Branch** (`version/devin`):
- Virtual environment: `.venv-devin`
- Database file: `dt_devin.db`
- Port: `8002`

## Common Preparation (Run Once)

```bash
# Sync local refs with GitHub
git fetch --all --prune

# Go to stable baseline
git switch main

# Ensure main is up to date
git pull --ff-only
```

## Testing Codex Branch (version/codex)

### Setup and Run

```bash
# Switch to Codex branch
git switch version/codex

# Create isolated Python environment
python3 -m venv .venv-codex

# Activate environment
source .venv-codex/bin/activate

# Install dependencies
pip install -r python/requirements.txt

# Set environment variables
export DATABASE_URL=sqlite:///dt_codex.db
export PORT=8001

# Run tests
python -m pytest -q

# Start API server
python python/teller.py
```

### Verify (in second terminal)

```bash
# Activate same environment
source .venv-codex/bin/activate

# Export port for convenience
export PORT=8001

# Smoke check: server alive
curl -sS http://localhost:$PORT/health

# Check cached accounts endpoint
curl -sS http://localhost:$PORT/api/db/accounts | head

# When done
deactivate
```

## Testing Devin Branch (version/devin)

### Setup and Run

```bash
# Switch to Devin branch
git switch version/devin

# Create isolated Python environment
python3 -m venv .venv-devin

# Activate environment
source .venv-devin/bin/activate

# Install dependencies
pip install -r python/requirements.txt

# Set environment variables
export DATABASE_URL=sqlite:///dt_devin.db
export PORT=8002

# Run tests
python -m pytest -q

# Start API server
python python/teller.py
```

### Verify (in second terminal)

```bash
# Activate same environment
source .venv-devin/bin/activate

# Export port for convenience
export PORT=8002

# Smoke check: server alive
curl -sS http://localhost:$PORT/health

# Check cached accounts endpoint
curl -sS http://localhost:$PORT/api/db/accounts | head

# When done
deactivate
```

## Compare Results

### Capture Evidence

```bash
# Codex branch results
curl -sS http://localhost:8001/health > test-results/codex.health.txt
curl -sS http://localhost:8001/api/db/accounts > test-results/codex.accounts.txt

# Devin branch results
curl -sS http://localhost:8002/health > test-results/devin.health.txt
curl -sS http://localhost:8002/api/db/accounts > test-results/devin.accounts.txt
```

### Compare Side-by-Side

```bash
# Compare health endpoints
diff test-results/codex.health.txt test-results/devin.health.txt

# Compare accounts endpoints
diff test-results/codex.accounts.txt test-results/devin.accounts.txt
```

## Return to Baseline

```bash
# Return to main branch
git switch main

# Deactivate any active virtualenv
deactivate
```

## PostgreSQL Testing (Optional)

If testing against PostgreSQL instead of SQLite:

### Codex with PostgreSQL

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/dt_codex?sslmode=disable"
export PORT=8001

cd python
alembic upgrade head
cd ..

python python/teller.py
```

### Devin with PostgreSQL

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/dt_devin?sslmode=disable"
export PORT=8002

cd python
alembic upgrade head
cd ..

python python/teller.py
```

## Important Notes

1. **Separate Virtualenvs**: `.venv-codex` and `.venv-devin` prevent dependency conflicts
2. **Separate Ports**: `8001` (Codex) and `8002` (Devin) allow both servers to run simultaneously
3. **Separate Databases**: `dt_codex.db` and `dt_devin.db` prevent data contamination
4. **Always Switch Branches**: Run `git switch` before any operations to ensure code matches environment
5. **Deactivate When Done**: Run `deactivate` to leave virtualenv cleanly

## Quick Reference

| Branch | Virtualenv | Database | Port |
|--------|-----------|----------|------|
| version/codex | `.venv-codex` | `dt_codex.db` | 8001 |
| version/devin | `.venv-devin` | `dt_devin.db` | 8002 |

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :8001  # or :8002

# Kill process if needed
kill -9 <PID>
```

### Wrong Virtualenv Active

```bash
# Check which virtualenv is active
which python

# Should show:
# .venv-codex/bin/python  (for Codex)
# .venv-devin/bin/python  (for Devin)

# If wrong, deactivate and activate correct one
deactivate
source .venv-codex/bin/activate  # or .venv-devin
```

### Database Conflicts

```bash
# Remove database files to start fresh
rm dt_codex.db dt_devin.db

# Re-run migrations if using PostgreSQL
cd python && alembic upgrade head && cd ..
```
