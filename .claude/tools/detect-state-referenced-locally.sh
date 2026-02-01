#!/bin/bash
# detect-state-referenced-locally.sh
# Detects potential $state(prop) patterns without proper sync
#
# Usage:
#   ./.claude/tools/detect-state-referenced-locally.sh
#
# This script scans for patterns where $state is initialized from props
# without a corresponding sync strategy ($effect or {#key}).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT" || exit 1

echo "Scanning for potential \$state(prop) issues..."
echo ""

TEMP_RESULTS=$(mktemp)
TEMP_INFO=$(mktemp)
trap 'rm -f $TEMP_RESULTS $TEMP_INFO' EXIT

ISSUES_FOUND=0
INFO_COUNT=0

for file in $(find src -name '*.svelte' -type f); do
    # Skip if no $state with prop reference
    if ! grep -q '\$state(' "$file" 2>/dev/null; then
        continue
    fi

    # Check for $state initialized from common prop patterns
    # e.g., $state(profile.name), $state(data.service.notes), $state(service.pickup_location)
    PROP_STATES=$(grep -n '\$state([a-zA-Z_][a-zA-Z0-9_]*\.' "$file" 2>/dev/null || true)

    if [ -z "$PROP_STATES" ]; then
        continue
    fi

    # Check if file has sync strategy
    HAS_EFFECT_SYNC=$(grep -c '\$effect' "$file" 2>/dev/null) || HAS_EFFECT_SYNC=0
    HAS_KEY_BLOCK=$(grep -c '{#key' "$file" 2>/dev/null) || HAS_KEY_BLOCK=0
    HAS_IGNORE=$(grep -c 'svelte-ignore state_referenced_locally' "$file" 2>/dev/null) || HAS_IGNORE=0

    # Count $state(prop) instances
    STATE_PROP_COUNT=$(echo "$PROP_STATES" | wc -l | tr -d ' ')

    # Case 1: No sync strategy at all - likely a bug
    if [ "$HAS_EFFECT_SYNC" -eq 0 ] && [ "$HAS_KEY_BLOCK" -eq 0 ]; then
        {
            echo "[WARNING] POTENTIAL BUG: $file"
            echo "   Found $STATE_PROP_COUNT \$state(prop) pattern(s) without sync strategy:"
            echo "$PROP_STATES" | head -5 | sed 's/^/   /'
            if [ "$HAS_IGNORE" -gt 0 ]; then
                echo "   Note: Has svelte-ignore but no \$effect or {#key} for sync"
            fi
            echo ""
        } >> "$TEMP_RESULTS"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    # Case 2: Has sync but no ignore - might be intentional but should verify
    elif [ "$HAS_IGNORE" -eq 0 ] && [ "$STATE_PROP_COUNT" -gt 0 ]; then
        {
            echo "[INFO] $file"
            echo "   Has \$state(prop) pattern(s) - verify sync strategy is correct:"
            echo "$PROP_STATES" | head -3 | sed 's/^/   /'
            if [ "$HAS_EFFECT_SYNC" -gt 0 ]; then
                echo "   Sync: Has \$effect (good)"
            fi
            if [ "$HAS_KEY_BLOCK" -gt 0 ]; then
                echo "   Sync: Has {#key} block (good)"
            fi
            echo ""
        } >> "$TEMP_INFO"
        INFO_COUNT=$((INFO_COUNT + 1))
    fi
    # Case 3: Has both sync and ignore - properly handled, skip
done

# Output results
if [ -s "$TEMP_RESULTS" ]; then
    cat "$TEMP_RESULTS"
    echo "============================================================"
    echo ""
fi

if [ -s "$TEMP_INFO" ]; then
    echo "Files with \$state(prop) patterns (have sync, missing ignore comment):"
    echo ""
    cat "$TEMP_INFO"
    echo "============================================================"
    echo ""
fi

# Summary
echo "SUMMARY"
echo "-------"
echo "  Potential bugs (no sync):  $ISSUES_FOUND"
echo "  Info (has sync, no ignore): $INFO_COUNT"
echo ""

if [ "$ISSUES_FOUND" -gt 0 ]; then
    echo "How to fix potential bugs:"
    echo ""
    echo "1. If value is DISPLAY-ONLY, use \$derived:"
    echo "   let name = \$derived(profile.name);"
    echo ""
    echo "2. If value is EDITABLE, add sync strategy:"
    echo ""
    echo "   Option A: Use \$effect to sync"
    echo "   // svelte-ignore state_referenced_locally"
    echo "   let name = \$state(profile.name);"
    echo "   \$effect(() => { name = profile.name; });"
    echo ""
    echo "   Option B: Use {#key} for component reset"
    echo "   {#key data.entity.id}"
    echo "   <FormComponent {data} />"
    echo "   {/key}"
    echo ""
    echo "See .claude/rules/svelte-state-referenced-locally.md for details"
    echo ""
    exit 1
fi

if [ "$INFO_COUNT" -gt 0 ]; then
    echo "Suggestion: Add svelte-ignore comments to documented patterns"
    echo "This helps future reviewers understand the sync strategy."
    echo ""
fi

echo "No obvious \$state(prop) issues detected."
exit 0
