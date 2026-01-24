# Pricing Models Have Duplicate Logic

---
status: ready
priority: p2
issue_id: "038"
tags: [code-quality, dry, refactor]
dependencies: []
---

**Priority**: P2 (Important)
**File**: `src/lib/services/pricing.ts:136-168`
**Source**: code-simplicity-reviewer

## Issue

`per_km` and `flat_plus_km` pricing models have identical calculation logic (lines 142-152). This is an unnecessary abstraction - both use the same formula: `base_fee + distanceKm * per_km_rate`.

## Related Issues

1. ~~`rollbackOptimisticUpdate` function unused~~ - **VERIFIED USED** in `src/routes/courier/+page.svelte:110` for error handling
2. `ServicePricingInput` interface includes unused warehouse-mode fields (`courierDefaultLocation`, `pickupLat`, `deliveryLat`) - these are defined but never used in actual calculations

## Fix

1. Consolidate identical pricing logic into single branch (or document why they're separate)
2. Remove unused interface fields OR implement warehouse-mode distance calculation

## Acceptance Criteria

- [ ] Duplicate pricing logic consolidated or documented
- [ ] Unused interface fields removed or implemented
- [ ] Pricing calculations still work correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by code-simplicity-reviewer | Identical switch cases should be consolidated |
| 2026-01-24 | Approved during triage | Status changed to ready |
