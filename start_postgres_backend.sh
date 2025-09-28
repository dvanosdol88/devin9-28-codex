#!/bin/bash

export DATABASE_URL="postgresql://teller_user:teller_password@localhost/teller_storage"

echo "Starting backend server with PostgreSQL..."
echo "DATABASE_URL: $DATABASE_URL"

cd python
python teller.py --environment sandbox
