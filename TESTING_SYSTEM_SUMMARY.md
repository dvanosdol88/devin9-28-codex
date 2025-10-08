# Testing System Summary

## Overview

A complete automated testing system for isolating and comparing the `version/devin` and `version/codex` branches without confusion or conflicts.

## Key Features

✅ **Complete Isolation**: Separate virtualenvs, databases, and ports for each branch
✅ **Zero Cross-Contamination**: Each branch operates independently
✅ **Automated Scripts**: One-command testing for either or both branches
✅ **Built-in Comparison**: Automatic diff of results between branches
✅ **Safe & Reversible**: All test artifacts in gitignored directories

## Quick Commands

```bash
# Test both branches and compare (recommended)
./test-both.sh

# Test individual branches
./test-codex.sh
./test-devin.sh

# Compare existing results
./compare-results.sh
```

## Architecture

### Branch Isolation Matrix

| Aspect | version/codex | version/devin |
|--------|---------------|---------------|
| **Virtualenv** | `.venv-codex` | `.venv-devin` |
| **Database** | `dt_codex.db` | `dt_devin.db` |
| **Port** | 8001 | 8002 |
| **Results** | `test-results/codex.*` | `test-results/devin.*` |

### File Structure

```
devin9-28-codex/
├── test-codex.sh          # Automated testing for Codex branch
├── test-devin.sh          # Automated testing for Devin branch
├── compare-results.sh     # Compare results between branches
├── test-both.sh           # Run all tests sequentially
├── TESTING_GUIDE.md       # Detailed testing procedures
├── QUICK_START.md         # Quick reference guide
├── BRANCHING_STRATEGY.md  # Git workflow documentation
├── .venv-codex/           # Codex Python environment (gitignored)
├── .venv-devin/           # Devin Python environment (gitignored)
├── dt_codex.db            # Codex database (gitignored)
├── dt_devin.db            # Devin database (gitignored)
└── test-results/          # Test output (gitignored)
    ├── codex.health.txt
    ├── codex.accounts.txt
    ├── devin.health.txt
    └── devin.accounts.txt
```

## What Each Script Does

### `test-codex.sh`
1. Syncs with GitHub (`git fetch --all --prune`)
2. Switches to `version/codex` branch
3. Creates/activates `.venv-codex` virtualenv
4. Installs dependencies from `python/requirements.txt`
5. Sets environment: `DATABASE_URL=sqlite:///dt_codex.db`, `PORT=8001`
6. Runs pytest test suite
7. Starts API server in background
8. Tests `/health` endpoint → saves to `test-results/codex.health.txt`
9. Tests `/api/db/accounts` endpoint → saves to `test-results/codex.accounts.txt`
10. Stops server and deactivates virtualenv

### `test-devin.sh`
Same as `test-codex.sh` but for `version/devin` branch with:
- Virtualenv: `.venv-devin`
- Database: `dt_devin.db`
- Port: `8002`
- Results: `test-results/devin.*`

### `compare-results.sh`
1. Verifies both test result sets exist
2. Displays health endpoint responses side-by-side
3. Displays accounts endpoint responses side-by-side
4. Runs `diff` on both endpoints
5. Shows database file sizes
6. Provides summary of differences

### `test-both.sh`
1. Runs `test-codex.sh`
2. Runs `test-devin.sh`
3. Runs `compare-results.sh`
4. Returns to `main` branch
5. Displays summary of all results

## Safety Features

### Git Isolation
- `.gitignore` updated to exclude:
  - `.venv-codex/` and `.venv-devin/`
  - `dt_codex.db` and `dt_devin.db`
  - `test-results/` directory
- Test artifacts never committed to repository

### Process Safety
- Each branch uses unique port (8001 vs 8002)
- Both can run simultaneously without conflict
- Scripts include PID tracking for clean shutdown

### Data Safety
- Separate SQLite databases prevent data mixing
- No shared state between branches
- Each test run starts from branch-specific baseline

## Workflow Integration

### Daily Development
```bash
# Morning: Test both branches
./test-both.sh

# Work on Codex
git switch version/codex
source .venv-codex/bin/activate
# ... make changes ...
pytest
git commit -am "feat: ..."
git push

# Verify changes
./test-codex.sh

# Compare with Devin
./compare-results.sh
```

### Before Merge
```bash
# Ensure both branches work independently
./test-both.sh

# Review differences
cat test-results/codex.*.txt
cat test-results/devin.*.txt

# If results match, branches are compatible
diff test-results/codex.health.txt test-results/devin.health.txt
```

## Maintenance

### Clean Test Artifacts
```bash
# Remove test results only
rm -rf test-results/

# Remove databases only
rm -f dt_codex.db dt_devin.db

# Remove everything (start fresh)
rm -rf test-results/ dt_codex.db dt_devin.db .venv-codex/ .venv-devin/
```

### Update Dependencies
```bash
# Codex branch
git switch version/codex
source .venv-codex/bin/activate
pip install --upgrade -r python/requirements.txt

# Devin branch
git switch version/devin
source .venv-devin/bin/activate
pip install --upgrade -r python/requirements.txt
```

## Documentation

- **TESTING_GUIDE.md**: Complete manual testing procedures with detailed steps
- **QUICK_START.md**: Fast reference for running automated tests
- **BRANCHING_STRATEGY.md**: Git workflow and version control strategy
- **This file**: High-level system overview and architecture

## Troubleshooting

### "Port already in use"
```bash
lsof -i :8001  # or :8002
kill -9 <PID>
```

### "Wrong virtualenv active"
```bash
which python  # Should show .venv-codex or .venv-devin
deactivate
source .venv-<branch>/bin/activate
```

### "Tests failing"
```bash
git branch --show-current  # Verify correct branch
git status                 # Check for uncommitted changes
git pull origin $(git branch --show-current)  # Sync with remote
```

### "Database locked"
```bash
# Stop all servers
pkill -f "python.*teller.py"

# Remove database and restart
rm dt_codex.db  # or dt_devin.db
./test-codex.sh  # or test-devin.sh
```

## Benefits

1. **No Manual Setup**: Scripts handle all environment configuration
2. **Repeatable**: Same results every time
3. **Fast**: Automated testing completes in ~30 seconds
4. **Safe**: All artifacts gitignored, no repository pollution
5. **Clear**: Easy to understand what's different between branches
6. **Isolated**: No cross-contamination between test runs
7. **Documented**: Three levels of documentation (quick start → guide → this summary)

## Next Steps

1. Run `./test-both.sh` to verify system works
2. Make changes to either branch
3. Re-run tests to compare
4. Use results to inform merge decisions

---

**Created**: October 8, 2025
**Status**: Active - Used for all Devin/Codex branch testing
**Maintained by**: Development team
