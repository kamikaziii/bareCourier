---
status: complete
priority: p2
issue_id: "207"
tags: [code-review, bug, greptile, pr-10]
dependencies: []
---

# Warehouse Mode Partial Fallback Not Tracked in Route Source

## Problem Statement

In warehouse mode, if the warehouse→pickup leg uses haversine fallback but the pickup→delivery leg succeeds via API, the `source` is incorrectly marked as `'api'` even though part of the total distance calculation used the less accurate haversine (straight-line) method.

This misleads users about the accuracy of the displayed distance.

## Findings

**Source:** Greptile code review comment on PR #10

**Bug location:** `src/lib/services/route.ts:72`

```typescript
source = routeGeometry ? 'api' : 'haversine';  // Only checks pickup→delivery!
```

**Root cause:** `calculateServiceDistance()` in `distance.ts` only returns `geometry` from the pickup→delivery leg. The warehouse→pickup leg's calculation method is not tracked.

**Bug scenario:**

| Leg | API Result | Method Used | Tracked? |
|-----|------------|-------------|----------|
| warehouse → pickup | ❌ FAILS | Haversine | ❌ NO |
| pickup → delivery | ✅ SUCCESS | API | ✅ YES |

**Result:** User sees `source: 'api'` but the total distance includes a haversine calculation that could be significantly less accurate (straight-line vs actual road distance).

## Proposed Solutions

### Option A: Track Source Per Leg (Recommended)

Add source tracking to `ServiceDistanceResult`:

```typescript
interface ServiceDistanceResult {
  // ... existing fields
  warehouseToPickupSource?: 'api' | 'haversine';
  pickupToDeliverySource: 'api' | 'haversine';
}
```

Then in `route.ts`:
```typescript
// Mark as haversine if ANY leg used fallback
const usedFallback = result.warehouseToPickupSource === 'haversine' ||
                     result.pickupToDeliverySource === 'haversine';
source = usedFallback ? 'haversine' : 'api';
```

- **Pros:** Accurate tracking, can show detailed info to user
- **Cons:** Interface change, more code
- **Effort:** Medium (1 hour)
- **Risk:** Low

### Option B: Return Composite Source from calculateServiceDistance

Add a single `source` field to `ServiceDistanceResult` that is `'haversine'` if either leg used fallback:

```typescript
interface ServiceDistanceResult {
  // ... existing fields
  source: 'api' | 'haversine';
}
```

- **Pros:** Simpler interface
- **Cons:** Less granular info
- **Effort:** Small (30 mins)
- **Risk:** Low

### Option C: Check for Missing Geometry on Both Legs

Track whether warehouse→pickup returned geometry (even if not displayed):

```typescript
// In calculateServiceDistance
let usedHaversineFallback = false;

if (!pickupDeliveryRoute) {
  usedHaversineFallback = true;
}
if (pricingMode === 'warehouse' && !warehousePickupRoute) {
  usedHaversineFallback = true;
}

return {
  // ... existing fields
  usedHaversineFallback
};
```

- **Pros:** Minimal interface change
- **Cons:** Boolean less informative than per-leg tracking
- **Effort:** Small (20 mins)
- **Risk:** Low

## Technical Details

**Files to modify:**
- `src/lib/services/distance.ts` - Add source tracking to `calculateServiceDistance`
- `src/lib/services/route.ts` - Update source detection logic

**Type changes:**
```typescript
// In distance.ts
export interface ServiceDistanceResult {
  totalDistanceKm: number;
  durationMinutes?: number;
  distanceMode: 'warehouse' | 'zone' | 'fallback';
  warehouseToPickupKm?: number;
  pickupToDeliveryKm: number;
  geometry?: string;
  // NEW: Track calculation sources
  sources?: {
    warehouseToPickup?: 'api' | 'haversine';
    pickupToDelivery: 'api' | 'haversine';
  };
}
```

## Acceptance Criteria

- [ ] If warehouse→pickup uses haversine fallback, `source` reflects this
- [ ] If pickup→delivery uses haversine fallback, `source` reflects this
- [ ] User sees amber warning when ANY leg used haversine
- [ ] UI message accurately describes the situation

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Greptile identified bug in PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
- Greptile comment: https://github.com/kamikaziii/bareCourier/pull/10#discussion_r2750327522
