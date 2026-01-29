---
status: complete
priority: p2
issue_id: "181"
tags: [code-review, typescript, pr-7]
dependencies: []
---

# `CourierPricingSettings.pricingMode` Missing 'type'

## Problem Statement

The `CourierPricingSettings` interface defines `pricingMode` as `'warehouse' | 'zone'` but the system now supports a third mode `'type'`. This type mismatch can lead to incorrect type checking.

## Findings

**Source:** Architecture Strategist Agent

**Location:** `src/lib/services/pricing.ts` (lines 56-67)

**Current Code:**
```typescript
export interface CourierPricingSettings {
    pricingMode: 'warehouse' | 'zone';  // Missing 'type'!
    // ...
}
```

**Impact:**
- TypeScript won't enforce handling of 'type' mode
- Default fallback to 'zone' at line 125 could mask bugs
- Type inconsistency across codebase

## Proposed Solutions

### Solution 1: Add 'type' to union (Recommended)
```typescript
export interface CourierPricingSettings {
    pricingMode: 'warehouse' | 'zone' | 'type';
    // ...
}
```
- **Pros:** Type safety, consistent
- **Cons:** None
- **Effort:** Small (2 min)
- **Risk:** Low

## Technical Details

**Affected Files:**
- `src/lib/services/pricing.ts`

## Acceptance Criteria

- [ ] `CourierPricingSettings.pricingMode` includes 'type'
- [ ] TypeScript compilation passes
- [ ] No runtime behavior change

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by architecture-strategist agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
