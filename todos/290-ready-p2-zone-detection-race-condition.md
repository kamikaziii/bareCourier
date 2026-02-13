---
status: ready
priority: p2
issue_id: 290
tags: [code-review, pr-18, correctness, race-condition]
dependencies: []
---

# Race condition in async zone detection

## Problem Statement

The `detectPickupZone`/`detectDeliveryZone` functions are now async (due to the reverse geocode network call) but have no cancellation or staleness protection. If a user selects address A then quickly selects address B, the response from A could arrive after B and overwrite the correct zone result.

Before this PR, `extractMunicipalityFromAddress()` was synchronous so races were impossible. The 100-200ms async window introduced by reverse geocoding creates a realistic race window.

## Findings

- Performance agent flagged as LOW-MEDIUM risk
- Affects all 4 page files with zone detection (8 functions total: pickup + delivery each)
- `checkingXxxZone = false` runs unconditionally, so the loading state could also be incorrectly cleared

**Locations:**
- `src/routes/client/new/+page.svelte`
- `src/routes/client/services/[id]/edit/+page.svelte`
- `src/routes/courier/services/new/+page.svelte`
- `src/routes/courier/services/[id]/edit/+page.svelte`

## Proposed Solutions

### Option A: Generation counter (Recommended)

```typescript
let pickupZoneGeneration = 0;

async function detectPickupZone(address: string, coords: [number, number] | null = null) {
    const gen = ++pickupZoneGeneration;
    checkingPickupZone = true;
    const result = await detectZone(data.supabase, address, coords);
    if (gen !== pickupZoneGeneration) return; // Stale, discard
    pickupDetectedMunicipality = result.municipality;
    pickupIsOutOfZone = result.isOutOfZone;
    checkingPickupZone = false;
}
```

- **Pros:** Simple, no external dependencies, 3 lines added per function
- **Cons:** Needs to be applied to 8 functions across 4 files
- **Effort:** Small (~5 lines per page, 4 pages)
- **Risk:** None

## Recommended Action

Option A.

## Technical Details

**Affected files:**
- 4 page files listed above (detectPickupZone + detectDeliveryZone in each)

**Acceptance Criteria:**
- [ ] Stale zone detection results are discarded
- [ ] Generation counters for both pickup and delivery in all 4 files

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-13 | Created from PR #18 code review | Performance agent |

## Resources

- PR #18: fix/zone-detection-and-pricing-safeguards
