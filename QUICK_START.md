# Quick Start Guide - Testing Devin & Codex Branches

## Fastest Way to Test Both Branches

```bash
./test-both.sh
```

This script runs the complete test suite for both branches and compares results automatically.

## Individual Branch Testing

### Test Codex Only

```bash
./test-codex.sh
```

### Test Devin Only

```bash
./test-devin.sh
```

### Compare Results

```bash
./compare-results.sh
```

(Only after running at least one individual test)

## What Each Script Does

### `test-codex.sh`
1. Syncs with GitHub
2. Switches to `version/codex` branch
3. Creates/activates `.venv-codex` virtualenv
4. Installs dependencies
5. Runs pytest
6. Starts API server on port **8001**
7. Tests `/health` endpoint
8. Tests `/api/db/accounts` endpoint
9. Saves results to `test-results/codex.*.txt`
10. Stops server and cleans up

### `test-devin.sh`
1. Syncs with GitHub
2. Switches to `version/devin` branch
3. Creates/activates `.venv-devin` virtualenv
4. Installs dependencies
5. Runs pytest
6. Starts API server on port **8002**
7. Tests `/health` endpoint
8. Tests `/api/db/accounts` endpoint
9. Saves results to `test-results/devin.*.txt`
10. Stops server and cleans up

### `compare-results.sh`
Compares the test output from both branches:
- Health endpoint responses
- Accounts endpoint responses
- Database sizes
- Response sizes

### `test-both.sh`
Runs all three scripts in sequence:
1. Test Codex → Test Devin → Compare Results
2. Returns you to `main` branch when done

## Environment Isolation

| Branch | Virtualenv | Database | Port |
|--------|-----------|----------|------|
| **version/codex** | `.venv-codex` | `dt_codex.db` | 8001 |
| **version/devin** | `.venv-devin` | `dt_devin.db` | 8002 |

Each branch has:
- ✅ Separate Python virtualenv (no dependency conflicts)
- ✅ Separate SQLite database (no data contamination)
- ✅ Separate port (both can run simultaneously if needed)

## Manual Testing (Optional)

If you want to manually test either branch:

### Codex Manual Testing

```bash
git switch version/codex
source .venv-codex/bin/activate
export DATABASE_URL=sqlite:///dt_codex.db
export PORT=8001
python python/teller.py
```

In another terminal:
```bash
curl http://localhost:8001/health
curl http://localhost:8001/api/db/accounts
```

### Devin Manual Testing

```bash
git switch version/devin
source .venv-devin/bin/activate
export DATABASE_URL=sqlite:///dt_devin.db
export PORT=8002
python python/teller.py
```

In another terminal:
```bash
curl http://localhost:8002/health
curl http://localhost:8002/api/db/accounts
```

## Results Location

All test results are saved in `test-results/` directory:
- `codex.health.txt` - Codex /health response
- `codex.accounts.txt` - Codex /api/db/accounts response
- `devin.health.txt` - Devin /health response
- `devin.accounts.txt` - Devin /api/db/accounts response

## Cleaning Up

To start fresh (delete databases and test results):

```bash
rm -rf dt_codex.db dt_devin.db test-results/
```

To delete virtualenvs (if you need to rebuild):

```bash
rm -rf .venv-codex .venv-devin
```

## Troubleshooting

### "Port already in use"

```bash
# Find and kill process on port 8001 or 8002
lsof -i :8001
kill -9 <PID>
```

### "Wrong virtualenv active"

```bash
deactivate
source .venv-codex/bin/activate  # or .venv-devin
```

### "Tests failing"

Check that you're on the correct branch:
```bash
git branch --show-current
```

Should show `version/codex` or `version/devin` when testing.

## Full Documentation

For detailed information, see:
- **TESTING_GUIDE.md** - Complete testing procedures
- **BRANCHING_STRATEGY.md** - Git workflow and branch management
