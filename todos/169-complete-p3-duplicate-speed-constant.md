---
status: ready
priority: p3
issue_id: "169"
tags: [code-review, duplication, refactor, pr-5]
dependencies: []
---

# Duplicate Speed Constant for Duration Estimation

## Problem Statement

The magic number `30` (km/h average city speed) is hardcoded in three separate locations for estimating driving duration from distance. This violates DRY and makes it difficult to adjust the speed estimate consistently.

## Findings

**Location 1:** `src/lib/services/distance.ts` (lines 186, 200)
```typescript
// Estimate duration: assume 30 km/h average city speed
pickupToDeliveryDuration = Math.round((pickupToDeliveryKm / 30) * 60);
```

**Location 2:** `src/lib/services/route.ts` (lines 75, 84)
```typescript
// Estimate duration: assume 30 km/h average city speed
durationMinutes = Math.round((distanceKm / 30) * 60);
```

**Location 3:** `src/lib/services/workload.ts` (line 107)
```typescript
// Assuming average speed of 30 km/h in urban delivery context
const drivingMinutes = distanceKm ? Math.round((distanceKm / 30) * 60) : null;
```

## Proposed Solutions

### Option A: Extract to Shared Constant (Recommended)

```typescript
// src/lib/services/distance.ts (or create src/lib/constants.ts)
export const AVERAGE_CITY_SPEED_KMH = 30;

export function estimateDrivingMinutes(distanceKm: number): number {
  return Math.round((distanceKm / AVERAGE_CITY_SPEED_KMH) * 60);
}
```

**Pros:** Single source of truth, easy to adjust, self-documenting
**Cons:** Minor refactor needed
**Effort:** Small
**Risk:** Low

### Option B: Add to Workload Settings

Make the speed configurable per courier in `workload_settings`.

**Pros:** Customizable for different delivery contexts
**Cons:** Over-engineering for current needs
**Effort:** Medium
**Risk:** Low

## Recommended Action

*To be filled during triage*

## Technical Details

**Affected files:**
- `src/lib/services/distance.ts`
- `src/lib/services/route.ts`
- `src/lib/services/workload.ts`

## Acceptance Criteria

- [ ] Speed constant defined in one location
- [ ] All three files use the shared constant or utility function
- [ ] Comments explain the 30 km/h assumption

## Work Log

### 2026-01-29 - Initial Finding

**By:** Code Review Agent (architecture-strategist, code-simplicity-reviewer)

**Actions:**
- Identified duplicate magic number during PR #5 review
- Searched for all occurrences across services

**Learnings:**
- Business constants should be extracted early to avoid drift

## Resources

- PR #5: https://github.com/kamikaziii/bareCourier/pull/5
