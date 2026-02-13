---
status: ready
priority: p2
issue_id: "295"
tags: [code-review, svelte, ux, pr-19]
dependencies: []
---

# Add showVerifiedAnimation to chip selection

## Problem Statement

When a user selects an address from the Mapbox autocomplete, the input shows a green verified animation (`showVerifiedAnimation`). When they tap a suggestion chip with valid coordinates, this animation is skipped — creating an inconsistent UX.

## Findings

- `handleSelect` (geocoding result) at `src/lib/components/AddressInput.svelte:62-74` triggers `showVerifiedAnimation = true` with a 600ms timeout
- `handleChipSelect` at `src/lib/components/AddressInput.svelte:103-111` sets `addressState` to `"verified"` when coords are present but never triggers the animation
- The green ring animation provides important visual feedback that the address is map-ready
- Found by: pattern-recognition-specialist agent

## Proposed Solutions

### Option 1: Add animation to handleChipSelect when coords present

**Approach:** Mirror the animation logic from `handleSelect` in `handleChipSelect` when `suggestion.coords` is truthy.

```typescript
function handleChipSelect(suggestion: AddressSuggestion, index: number) {
    value = suggestion.address;
    selectedChipIndex = index;
    onSelect(suggestion.address, suggestion.coords);
    showSuggestions = false;
    suggestions = [];
    addressState = suggestion.coords ? "verified" : "custom";
    if (suggestion.coords) {
        showVerifiedAnimation = true;
        setTimeout(() => { showVerifiedAnimation = false; }, 600);
    }
}
```

**Pros:** Consistent UX, minimal change
**Cons:** Slight duplication of animation logic
**Effort:** 5 minutes
**Risk:** Low

## Recommended Action

## Technical Details

**Affected files:**
- `src/lib/components/AddressInput.svelte:103-111` — handleChipSelect function

## Resources

- **PR:** #19
- **Related:** Finding from pattern-recognition-specialist agent

## Acceptance Criteria

- [ ] Tapping a chip with coordinates shows the green verified animation
- [ ] Tapping a chip without coordinates does NOT show the animation
- [ ] Animation timing matches the geocoding selection animation (600ms)

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Claude Code (PR #19 review)

**Actions:**
- Identified missing animation in handleChipSelect vs handleSelect
- Compared the two code paths for behavioral differences

**Learnings:**
- handleChipSelect correctly differentiates verified/custom state but skips the visual animation
