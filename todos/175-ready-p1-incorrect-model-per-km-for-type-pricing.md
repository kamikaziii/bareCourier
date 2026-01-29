---
status: ready
priority: p1
issue_id: "175"
tags: [code-review, data-integrity, pr-7]
dependencies: []
---

# Incorrect `model: 'per_km'` Stored for Type-Based Pricing

## Problem Statement

Route handlers store `model: 'per_km'` in the `price_breakdown` field when type-based pricing is used, with a comment "Compatibility - actual pricing is type-based". This causes incorrect data to be persisted to the database, making it impossible to identify which services used type-based pricing.

## Findings

**Source:** Architecture Strategist Agent

**Locations:**
- `src/routes/courier/services/new/+page.server.ts` (lines 177-184)
- `src/routes/client/new/+page.server.ts` (lines 133-140)

**Code:**
```typescript
price_breakdown = {
    base: typeResult.breakdown.base,
    distance: typeResult.breakdown.distance,
    urgency: 0,
    total: typeResult.breakdown.total,
    model: 'per_km', // Compatibility - actual pricing is type-based  <-- WRONG
    distance_km: distance_km ?? 0
};
```

**Contrast with correct implementation in pricing.ts (lines 288-304):**
```typescript
const breakdown: PriceBreakdown = {
    model: 'type',  // CORRECT
    tolls: result.breakdown.tolls,
    reason: result.breakdown.reason,
    service_type_name: result.breakdown.serviceTypeName
};
```

**Impact:**
- Services created will have incorrect model stored
- Reports grouping by pricing model will miscount
- Future code branching on model type will malfunction

## Proposed Solutions

### Solution 1: Use `calculateServicePrice` from routes (Recommended)
- **Pros:** Already handles this correctly, single source of truth
- **Cons:** Minor refactoring needed
- **Effort:** Small
- **Risk:** Low

### Solution 2: Fix the inline breakdown manually
- **Pros:** Minimal change
- **Cons:** Maintains code duplication
- **Effort:** Small
- **Risk:** Low

## Technical Details

**Affected Files:**
- `src/routes/courier/services/new/+page.server.ts`
- `src/routes/client/new/+page.server.ts`

**Type Definition (already correct):**
`src/lib/database.types.ts` line 27: `model: 'per_km' | 'zone' | 'flat_plus_km' | 'type'`

## Acceptance Criteria

- [ ] Services created with type-based pricing have `model: 'type'` in price_breakdown
- [ ] Type-specific fields (tolls, reason, service_type_name) are preserved
- [ ] Existing distance-based pricing continues to work

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by architecture-strategist agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
- Correct implementation: `src/lib/services/pricing.ts:288-304`
