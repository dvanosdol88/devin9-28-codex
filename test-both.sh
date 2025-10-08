#!/bin/bash
# test-both.sh - Run both branch tests sequentially and compare

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Running Complete Test Suite for Both Branches        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Ensure we're in the right directory
if [ ! -f "BRANCHING_STRATEGY.md" ]; then
    echo "❌ Error: Must run from repository root"
    exit 1
fi

# Create test-results directory
mkdir -p test-results

# Test Codex branch
echo "🔵 STEP 1: Testing Codex Branch"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash test-codex.sh
echo ""

# Wait a moment between tests
sleep 2

# Test Devin branch
echo "🟢 STEP 2: Testing Devin Branch"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash test-devin.sh
echo ""

# Wait a moment before comparison
sleep 1

# Compare results
echo "🔍 STEP 3: Comparing Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash compare-results.sh
echo ""

# Return to main
echo "🏁 STEP 4: Returning to Main Branch"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git switch main
echo "✅ Switched back to main"
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║  All Tests Complete!                                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📁 Results available in test-results/ directory:"
echo "   - codex.health.txt"
echo "   - codex.accounts.txt"
echo "   - devin.health.txt"
echo "   - devin.accounts.txt"
echo ""
echo "💾 Database files:"
echo "   - dt_codex.db (Codex branch data)"
echo "   - dt_devin.db (Devin branch data)"
