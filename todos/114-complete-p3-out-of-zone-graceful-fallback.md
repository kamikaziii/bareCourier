---
status: complete
priority: p3
issue_id: "114"
tags: [type-pricing, error-handling, graceful-degradation]
dependencies: []
---

# Out-of-Zone Price Calculation Doesn't Fail Gracefully

## Problem Statement
When calculating out-of-zone pricing, if distance is null, the function returns an error. However, callers don't handle this gracefully - services are created with `null` price and no user feedback.

## Findings
- Location: `src/lib/services/type-pricing.ts:207-217`
- Returns error if `distanceKm` is null for out-of-zone
- Callers (page.server.ts) don't display the error
- Services created with `calculated_price = null`

## Problem Scenario
1. Delivery marked as out-of-zone
2. GPS coordinates not available (no distance)
3. `calculateTypedPrice` returns error
4. Service created with null price
5. No user feedback about why price couldn't be calculated

## Proposed Solutions

### Option 1: Calculate with distance=0 (Recommended)
```typescript
if (input.isOutOfZone) {
    const base = settings.outOfZoneBase;
    const distance = (input.distanceKm ?? 0) * settings.outOfZonePerKm;
    const tolls = input.tolls ?? 0;
    // Continue with base price only
}
```
- **Pros**: Always calculates a price, non-blocking
- **Cons**: May undercharge if distance unknown
- **Effort**: Small
- **Risk**: Low

### Option 2: Return warning with base price
```typescript
return {
    success: true,
    price: settings.outOfZoneBase + (input.tolls ?? 0),
    breakdown: { ... },
    warning: 'Distance unknown - base price only'
};
```
- **Pros**: Transparency about missing distance
- **Cons**: Requires UI changes to show warning
- **Effort**: Medium
- **Risk**: Low

## Recommended Action
Option 1: Use distance=0 when not available, ensuring a price is always calculated.

## Technical Details
- **Affected Files**: `src/lib/services/type-pricing.ts`
- **Related Components**: All type-based pricing callers
- **Database Changes**: No

## Resources
- Original finding: Pricing Audit 2025-01-29 (L1)

## Acceptance Criteria
- [ ] Out-of-zone calculation never fails due to missing distance
- [ ] Base price + tolls calculated when distance unknown
- [ ] Price breakdown indicates distance=0 if applicable
- [ ] Tests pass

## Work Log

### 2025-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Low priority, nice-to-have improvement

## Notes
Source: Pricing Audit findings verification 2025-01-29
