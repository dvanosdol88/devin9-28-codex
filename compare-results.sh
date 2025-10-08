#!/bin/bash
# compare-results.sh - Compare test results from both branches

set -e

echo "=== Comparing Codex vs Devin Results ==="
echo ""

# Check if test results exist
if [ ! -f "test-results/codex.health.txt" ]; then
    echo "❌ Codex results not found. Run ./test-codex.sh first."
    exit 1
fi

if [ ! -f "test-results/devin.health.txt" ]; then
    echo "❌ Devin results not found. Run ./test-devin.sh first."
    exit 1
fi

echo "📊 Health Endpoint Comparison"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Codex (/health):"
cat test-results/codex.health.txt
echo ""

echo "Devin (/health):"
cat test-results/devin.health.txt
echo ""

echo "Diff:"
if diff -q test-results/codex.health.txt test-results/devin.health.txt > /dev/null; then
    echo "✅ Health endpoints are identical"
else
    echo "⚠️  Health endpoints differ:"
    diff test-results/codex.health.txt test-results/devin.health.txt || true
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📊 Accounts Endpoint Comparison"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Codex (/api/db/accounts) - First 10 lines:"
head -10 test-results/codex.accounts.txt 2>/dev/null || echo "(empty or error)"
echo ""

echo "Devin (/api/db/accounts) - First 10 lines:"
head -10 test-results/devin.accounts.txt 2>/dev/null || echo "(empty or error)"
echo ""

echo "Diff (first 100 lines):"
if diff -q <(head -100 test-results/codex.accounts.txt) <(head -100 test-results/devin.accounts.txt) > /dev/null 2>&1; then
    echo "✅ Accounts endpoints are identical (first 100 lines)"
else
    echo "⚠️  Accounts endpoints differ:"
    diff <(head -100 test-results/codex.accounts.txt) <(head -100 test-results/devin.accounts.txt) || true
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📈 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CODEX_SIZE=$(wc -c < test-results/codex.accounts.txt 2>/dev/null || echo "0")
DEVIN_SIZE=$(wc -c < test-results/devin.accounts.txt 2>/dev/null || echo "0")

echo "Codex accounts response size: $CODEX_SIZE bytes"
echo "Devin accounts response size: $DEVIN_SIZE bytes"
echo ""

if [ -f "dt_codex.db" ]; then
    CODEX_DB_SIZE=$(wc -c < dt_codex.db)
    echo "Codex database size: $CODEX_DB_SIZE bytes"
fi

if [ -f "dt_devin.db" ]; then
    DEVIN_DB_SIZE=$(wc -c < dt_devin.db)
    echo "Devin database size: $DEVIN_DB_SIZE bytes"
fi

echo ""
echo "Full results available in test-results/ directory"
