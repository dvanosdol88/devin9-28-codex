# Repository Guidelines

## Project Structure & Module Organization
- `python/`: Backend service — `teller.py` (Falcon API) and `db.py` (SQLAlchemy models, `init_db()`).
- `static/`: Frontend assets — `index.html`, `dashboard.html`, `index.js`, `index.css`, `js/app.js`.
- Scripts: `static.sh` (serve static at :8000), `start_postgres_backend.sh` (Postgres env helper).
- Tests: `python/test_storage_persistence.py`, `test_postgres.py`.
- Dev data: `devin_teller.db` (SQLite) — for local only.

## Build, Test, and Development Commands
- Setup: `python3 -m venv .venv && source .venv/bin/activate && pip install -r python/requirements.txt`
- Backend (SQLite): `cd python && python teller.py --environment sandbox`
- Backend (Postgres): `export DATABASE_URL=postgresql://user:pass@host/db && cd python && python teller.py --environment production --cert cert.pem --cert-key private_key.pem` (or `./start_postgres_backend.sh` for local)
- Frontend: `./static.sh` then visit `http://localhost:8000`
- Tests: `cd python && python test_storage_persistence.py` and `python test_postgres.py`

## Coding Style & Naming Conventions
- Python: PEP 8, 4‑space indent, `snake_case` for functions/vars, `PascalCase` for classes. Keep lines ≤ 79 (flake8 default). Group imports: stdlib, third‑party, local.
- Linting: run `flake8 python` before opening PRs.
- JS/CSS/HTML: keep filenames lowercase (kebab/underscore), prefer `const`/`let`, avoid leaking globals.

## Testing Guidelines
- Use `test_*.py` files and `test_*` functions. Keep tests deterministic (SQLite by default).
- For Postgres integration, set `DATABASE_URL` and run `python test_postgres.py`.
- Verify persistence paths with `python/test_storage_persistence.py` after backend changes.

## Commit & Pull Request Guidelines
- Commits: imperative present tense, short summary (≤ 72 chars), explain “why” in body; reference issues (e.g., `Fix #123`).
- PRs: clear description, scope of changes, test steps, and screenshots/GIFs for UI. Link issues, keep diffs focused, ensure `flake8` and tests pass.

## Security & Configuration Tips
- Do not commit secrets, TLS certs, or real access tokens. Place prod certs in `python/` locally (`cert.pem`, `private_key.pem`).
- Configure via env: `DATABASE_URL`, `TELLER_APPLICATION_ID`, `TELLER_ENVIRONMENT`.
- Treat `*.db` files as local artifacts; exclude from PRs.

