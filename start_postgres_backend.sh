#!/bin/bash
set -euo pipefail

if [ -f .env ]; then
  export $(grep -v '^\s*#' .env | xargs)
fi

: "${POSTGRES_USER:=teller_user}"
: "${POSTGRES_PASSWORD:=change_me}"
: "${POSTGRES_DB:=teller_storage}"
: "${POSTGRES_HOST:=localhost}"

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}/${POSTGRES_DB}"

echo "Starting backend server with PostgreSQL..."
echo "DATABASE_URL: $DATABASE_URL"

cd python
python teller.py --environment sandbox
