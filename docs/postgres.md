# PostgreSQL Setup and Configuration

## Overview

This application uses PostgreSQL for persistent data storage in production, with support for local development using either SQLite or PostgreSQL via Docker.

## Database Schema

The application uses SQLAlchemy ORM with three main models defined in `python/db.py`:

- **Account**: Bank account information (id, name, institution_id, type, subtype, last_four)
- **BalanceSnapshot**: Account balance data with timestamps (account_id, available, ledger, as_of)
- **Transaction**: Transaction history (id, account_id, date, description, amount, raw JSON data)

## Render PostgreSQL Setup

### Database Details
- **Render Resource Name**: devin_teller_llc_finance
- **Database Name**: teller_storage
- **Database User**: teller_storage_user
- **Region**: Oregon
- **Connection String**: Available in Render Dashboard

### Environment Configuration

The application uses the `DATABASE_URL` environment variable for database connections:

```bash
export DATABASE_URL="postgresql://teller_storage_user:PASSWORD@HOST/teller_storage?sslmode=require"
```

**Important**: The `?sslmode=require` parameter is mandatory for Render PostgreSQL connections.

### Render Deployment

The application is configured via `render.yaml` with:
- Automatic Alembic migrations on deployment
- DATABASE_URL configured as environment variable
- Health check endpoint at `/health`

The startCommand ensures migrations run before the server starts:
```bash
cd python && alembic upgrade head && python teller.py --environment sandbox
```

## Local Development

### Option 1: SQLite (Default)
No configuration needed. The application defaults to `sqlite:///devin_teller.db` if DATABASE_URL is not set.

```bash
cd python
python teller.py --environment sandbox
```

### Option 2: Docker PostgreSQL

1. Start the PostgreSQL container:
```bash
docker compose up -d db
```

2. Set DATABASE_URL:
```bash
export $(grep -v '^\s*#' .env | xargs)
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB}"
```

3. Run migrations:
```bash
cd python
alembic upgrade head
```

4. Start the application:
```bash
python teller.py --environment sandbox
```

## Alembic Migrations

### Overview
Alembic manages database schema changes. Configuration is in `python/alembic.ini` and `python/alembic/env.py`.

### Running Migrations

Apply all pending migrations:
```bash
cd python
alembic upgrade head
```

Check current migration status:
```bash
alembic current
```

View migration history:
```bash
alembic history
```

Downgrade to a specific revision:
```bash
alembic downgrade <revision>
```

### Creating New Migrations

After modifying models in `db.py`:
```bash
cd python
alembic revision --autogenerate -m "Description of changes"
alembic upgrade head
```

**Note**: Always review auto-generated migrations before applying them, as Alembic may not detect all schema changes.

## Testing Database Connection

### Quick Connection Test
```bash
cd python
python test_postgres.py
```

This script verifies:
- Database connectivity
- Schema creation
- CRUD operations
- Data persistence

### Smoke Test Results
The Render PostgreSQL database has been verified with:
- ✅ Schema initialization successful
- ✅ Account creation and retrieval
- ✅ Balance snapshot storage
- ✅ Transaction persistence

## Troubleshooting

### SSL Connection Required
**Error**: `SSL connection required`

**Solution**: Ensure `?sslmode=require` is appended to DATABASE_URL for production/Render databases.

```bash
export DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
```

### Connection Refused
**Error**: `Connection refused` or `Could not connect to server`

**Solution**: 
- Verify DATABASE_URL is correctly set: `echo $DATABASE_URL`
- Check that the database is running (for Docker): `docker ps`
- Verify IP allowlist includes your connection source (for Render)
- Ensure the database host and port are correct

### Migration Conflicts
**Error**: `Target database is not up to date`

**Solution**: Run `alembic upgrade head` to apply pending migrations.

### Schema Drift
Check for differences between models and database:
```bash
cd python
alembic check
```

**Note**: Requires Alembic 1.13+

### Port Already in Use
**Error**: `Address already in use` on port 5432 or 8001

**Solution**:
```bash
lsof -ti:5432 | xargs kill -9
lsof -ti:8001 | xargs kill -9
```

### Docker Container Issues
**Error**: Database container fails to start

**Solution**:
```bash
docker compose down -v
docker compose up -d db
```

## Security Best Practices

1. **Never commit credentials**: Use environment variables for DATABASE_URL
2. **Use SSL in production**: Always append `?sslmode=require` for Render PostgreSQL
3. **Restrict IP access**: Configure Render's IP allowlist as needed
4. **Rotate credentials**: Update connection strings when credentials change
5. **Use read replicas**: For read-heavy workloads, consider Render's read replica feature

## Database Maintenance

### Backup Strategy
Render provides automatic daily backups for PostgreSQL databases. To create a manual backup:

1. Navigate to your database in Render Dashboard
2. Click "Backups" tab
3. Click "Create Backup"

### Monitoring
Monitor database performance in Render Dashboard:
- Connection count
- Query performance
- Disk usage
- Memory usage

### Scaling
If you need to scale your database:
1. Upgrade to a higher tier plan in Render Dashboard
2. Consider adding read replicas for read-heavy workloads
3. Implement connection pooling (e.g., PgBouncer)

## Connection Pooling

For production workloads, consider using SQLAlchemy's connection pooling:

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True
)
```

Current configuration uses default pooling settings, which work well for most use cases.

## Additional Resources

- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [Render PostgreSQL Guide](https://render.com/docs/databases)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
