---
status: ready
priority: p1
issue_id: "274"
tags: [bug, pricing, type-based]
dependencies: []
---

# minimumCharge Not Applied for Type-Based Pricing

## Problem Statement
`pricing.ts:286-318` — the type-based pricing branch returns without applying `Math.max(finalPrice, minimumCharge)`. The distance-based branch at lines 370-372 correctly enforces it. All three route files also call `calculateTypedPrice()` directly, bypassing minimum charge.

## Findings
- Location: `src/lib/services/pricing.ts:286-318` (type branch, no min charge)
- Comparison: `src/lib/services/pricing.ts:370-372` (distance branch, has min charge)
- Route files calling directly: `client/new`, `courier/services/new`, `courier/services/[id]/edit`
- Impact: Services priced below courier's configured minimum charge

## Proposed Solutions

### Option 1: Apply minimumCharge in calculateServicePrice type branch
- After getting result from `calculateTypedPrice()`, apply `Math.max(result.price, minimumCharge)`
- **Pros**: Centralized fix, consistent with distance branch
- **Cons**: None
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Recommended Action
Add `Math.max(finalPrice, minimumCharge)` to the type-based pricing branch in `calculateServicePrice`.

## Technical Details
- **Affected Files**: `src/lib/services/pricing.ts`
- **Related Components**: All service creation routes
- **Database Changes**: No

## Acceptance Criteria
- [ ] Type-based pricing respects minimum charge setting
- [ ] Distance-based pricing still works correctly
- [ ] Price breakdown reflects minimum charge when applied

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06
