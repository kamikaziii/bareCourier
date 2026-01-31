#!/bin/bash
# detect-derived-mutations.sh
# Detects potential $derived mutation anti-patterns in Svelte files
#
# Usage:
#   ./.claude/tools/detect-derived-mutations.sh
#
# This script scans for patterns where $derived values are mutated,
# which won't trigger Svelte 5 reactivity.

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT" || exit 1

echo "🔍 Scanning for potential \$derived mutation anti-patterns..."
echo ""

# Temporary file for results
TEMP_RESULTS=$(mktemp)
trap 'rm -f $TEMP_RESULTS' EXIT

# Find all .svelte files with $derived
for file in $(find src -name '*.svelte' -type f); do
    if ! grep -q '\$derived' "$file" 2>/dev/null; then
        continue
    fi

    # Extract variable names
    VARS=$(grep -E 'let\s+\w+\s*=\s*\$derived' "$file" | sed -E 's/.*let\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\$derived.*/\1/g')

    for var in $VARS; do
        # Skip empty
        [ -z "$var" ] && continue

        # Check for array mutations
        if grep -q -E "$var\.(push|pop|shift|unshift|splice|sort|reverse)\(" "$file" 2>/dev/null; then
            {
                echo "⚠️  POTENTIAL BUG: $file"
                echo "   Variable '$var' is \$derived but has array mutation:"
                grep -n -E "$var\.(push|pop|shift|unshift|splice|sort|reverse)\(" "$file" | head -3 | sed 's/^/   /'
                echo ""
            } >> "$TEMP_RESULTS"
        fi

        # Check for index assignment
        if grep -q -E "$var\[[^]]+\]\s*=" "$file" 2>/dev/null; then
            {
                echo "⚠️  POTENTIAL BUG: $file"
                echo "   Variable '$var' is \$derived but may have index assignment:"
                grep -n -E "$var\[[^]]+\]\s*=" "$file" | head -3 | sed 's/^/   /'
                echo ""
            } >> "$TEMP_RESULTS"
        fi
    done
done

# Output results
if [ -s "$TEMP_RESULTS" ]; then
    cat "$TEMP_RESULTS"
    ISSUE_COUNT=$(grep -c "⚠️" "$TEMP_RESULTS" || echo "0")
    echo "❌ Found $ISSUE_COUNT potential issue(s)"
    echo ""
    echo "💡 How to fix:"
    echo "   1. Use \$state instead of \$derived for values that need mutations"
    echo "   2. Use immutable updates:"
    echo "      • items = [...items, newItem]  (not items.push(newItem))"
    echo "      • items = items.filter(...)     (not items.splice(...))"
    echo "      • obj = { ...obj, key: value }  (not obj.key = value)"
    echo ""
    echo "📖 See .claude/rules/svelte-reactive-mutation-prevention.md for details"
    exit 1
else
    echo "✅ No obvious \$derived mutation issues detected"
    echo ""
    echo "Note: This tool checks for common mutation patterns like:"
    echo "  • array.push(), array.splice(), etc."
    echo "  • array[index] = value"
    echo ""
    echo "Always verify mutations use immutable patterns."
    exit 0
fi
