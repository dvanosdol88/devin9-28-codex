#!/bin/bash
# test-devin.sh - Test version/devin branch in isolation

set -e  # Exit on error

echo "=== Testing Devin Branch ==="

# Common prep
echo "1. Syncing with remote..."
git fetch --all --prune

# Switch to devin branch
echo "2. Switching to version/devin..."
git switch version/devin

# Create virtualenv if it doesn't exist
if [ ! -d ".venv-devin" ]; then
    echo "3. Creating virtualenv (.venv-devin)..."
    python3 -m venv .venv-devin
fi

# Activate virtualenv
echo "4. Activating virtualenv..."
source .venv-devin/bin/activate

# Install/update dependencies
echo "5. Installing dependencies..."
pip install -q -r python/requirements.txt

# Set environment variables
export DATABASE_URL=sqlite:///dt_devin.db
export PORT=8002

# Run tests
echo "6. Running tests..."
python -m pytest -q

# Create test-results directory if it doesn't exist
mkdir -p test-results

# Start server in background
echo "7. Starting API server on port $PORT..."
python python/teller.py &
SERVER_PID=$!

# Wait for server to start
echo "8. Waiting for server to start..."
sleep 3

# Run health check
echo "9. Running health check..."
curl -sS http://localhost:$PORT/health > test-results/devin.health.txt
cat test-results/devin.health.txt

# Get accounts data
echo "10. Fetching accounts data..."
curl -sS http://localhost:$PORT/api/db/accounts > test-results/devin.accounts.txt 2>/dev/null || echo "No accounts yet"

# Show first few lines
head test-results/devin.accounts.txt 2>/dev/null || echo "(empty)"

# Stop server
echo "11. Stopping server..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

# Deactivate virtualenv
deactivate

echo ""
echo "=== Devin Testing Complete ==="
echo "Results saved to:"
echo "  - test-results/devin.health.txt"
echo "  - test-results/devin.accounts.txt"
echo ""
echo "Database: dt_devin.db"
echo "Port: 8002"
