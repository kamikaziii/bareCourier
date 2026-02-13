---
status: complete
priority: p2
issue_id: "297"
tags: [code-review, dry, typescript, pr-19]
dependencies: []
---

# Extract duplicated frequency-map logic in +page.ts

## Problem Statement

The pickup and delivery frequency map building logic in `+page.ts` is near-identical (~30 lines of copy-paste). Only the field names differ (`pickup_location` vs `delivery_location`, etc.). This doubles the maintenance surface for any future change to the aggregation logic.

## Findings

- Pickup map: `src/routes/client/new/+page.ts:102-115`
- Delivery map: `src/routes/client/new/+page.ts:118-131`
- Both follow identical pattern: Map → forEach → entries → map → sort
- The simplicity reviewer estimated this alone saves ~15 lines
- Found by: kieran-typescript-reviewer, pattern-recognition-specialist, code-simplicity-reviewer agents

## Proposed Solutions

### Option 1: Extract buildFrequencyRows with accessor function

**Approach:** Create a generic helper that takes an accessor function:

```typescript
function rankByFrequency(
    services: typeof pastServices,
    getFields: (s: typeof pastServices[number]) => { location: string | null; lat: number | null; lng: number | null }
): { location: string; lat: number | null; lng: number | null; count: number }[] {
    const map = new Map<string, { lat: number | null; lng: number | null; count: number; lastIndex: number }>();
    services.forEach((s, i) => {
        const { location, lat, lng } = getFields(s);
        if (!location) return;
        const existing = map.get(location);
        if (existing) existing.count++;
        else map.set(location, { lat, lng, count: 1, lastIndex: i });
    });
    return [...map.entries()]
        .map(([location, d]) => ({ location, ...d }))
        .sort((a, b) => b.count - a.count || a.lastIndex - b.lastIndex);
}
```

**Pros:** Single source of truth, type-safe, testable in isolation
**Cons:** Slightly more abstract than inline code
**Effort:** 15 minutes
**Risk:** Low

## Recommended Action

## Technical Details

**Affected files:**
- `src/routes/client/new/+page.ts:102-131` — replace two blocks with two calls

## Resources

- **PR:** #19

## Acceptance Criteria

- [ ] Pickup and delivery frequency logic share a single function
- [ ] No behavioral change (same sorting: frequency DESC, recency ASC)
- [ ] `pnpm run check` passes
- [ ] E2E tests pass

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Claude Code (PR #19 review)

**Actions:**
- Compared pickup and delivery map-building blocks, confirmed structural identity
- All three code-quality agents flagged independently
