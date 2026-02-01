---
status: complete
priority: p3
issue_id: "204"
tags: [code-review, dry, pr-10]
dependencies: []
---

# Duplicate `formatNumber` in TimePreferencePicker

## Problem Statement

`TimePreferencePicker.svelte` has a local `formatNumber` function that duplicates the formatting pattern used by the shared utilities in `utils.ts`.

## Findings

**Reviewers:** code-simplicity-reviewer

**Local implementation in TimePreferencePicker.svelte:21-26:**
```typescript
function formatNumber(value: number): string {
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
```

This is similar to `formatDistance()` but with fixed 2 decimal places.

## Proposed Solutions

### Option A: Use `formatDistance(value, 2)` (Recommended)

Replace local function with shared utility:
```typescript
import { formatDistance } from '$lib/utils.js';
// Then use: formatDistance(value, 2)
```

- **Pros:** Reuses existing utility
- **Cons:** None
- **Effort:** Trivial (5 mins)
- **Risk:** None

### Option B: Add `formatNumber` to utils.ts

If this pattern is needed elsewhere, add a generic `formatNumber` utility.

- **Pros:** More explicit naming
- **Cons:** Another utility function
- **Effort:** Small (15 mins)
- **Risk:** None

## Technical Details

**File to modify:**
- `src/lib/components/TimePreferencePicker.svelte`

## Acceptance Criteria

- [ ] No duplicate formatting functions
- [ ] Uses shared utilities from utils.ts

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
