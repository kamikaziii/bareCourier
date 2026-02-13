---
status: ready
priority: p2
issue_id: 289
tags: [code-review, pr-18, performance, geocoding]
dependencies: []
---

# Uncached reverse geocode adds 100-200ms latency per address selection

## Problem Statement

The new `reverseGeocode()` function makes a fresh HTTP call to Mapbox on every invocation. Each address selection now triggers an additional network round-trip (~100-200ms) that didn't exist before. There is no caching, so repeated lookups for the same coordinates (e.g., navigating away and back, default address on page load) always hit the network.

## Findings

- Performance agent identified this as the main performance concern
- Before PR: zone detection was synchronous (string parsing only) -- ~0ms
- After PR: reverse geocode (~100-200ms) + Supabase zone check (~20ms) = ~150-250ms sequential
- The `zoneCheckInProgress` spinner was added precisely because this is now slow enough to be visible
- Same coordinates can be reverse geocoded multiple times per session
- Acceptable for solo courier app but easy to optimize

**Location:** `src/lib/services/geocoding.ts:125-165`

## Proposed Solutions

### Option A: In-memory Map cache (Recommended)

```typescript
const reverseGeocodeCache = new Map<string, ReverseGeocodeResult>();

export async function reverseGeocode(lng: number, lat: number): Promise<ReverseGeocodeResult> {
    const cacheKey = `${lng.toFixed(6)},${lat.toFixed(6)}`;
    const cached = reverseGeocodeCache.get(cacheKey);
    if (cached) return cached;

    // ... existing fetch logic ...

    reverseGeocodeCache.set(cacheKey, result);
    return result;
}
```

- **Pros:** ~10 lines, eliminates repeated calls, session-scoped
- **Cons:** Unbounded cache growth (mitigated: municipality boundaries don't change, cache per browser session)
- **Effort:** Small
- **Risk:** None

## Recommended Action

Option A.

## Technical Details

**Affected files:**
- `src/lib/services/geocoding.ts`

**Acceptance Criteria:**
- [ ] Same coordinates return cached result without network call
- [ ] Cache keyed by `lng.toFixed(6),lat.toFixed(6)` to handle floating point

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-13 | Created from PR #18 code review | Performance agent |

## Resources

- PR #18: fix/zone-detection-and-pricing-safeguards
