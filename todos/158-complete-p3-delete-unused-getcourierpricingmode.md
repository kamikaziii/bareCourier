---
status: ready
priority: p3
issue_id: "158"
tags: [dead-code, cleanup, pricing]
dependencies: []
---

# Delete Unused `getCourierPricingMode()` Function

## Problem Statement
`getCourierPricingMode()` is a dead code function that is never imported anywhere in the codebase. It's a redundant subset of `getCourierPricingSettings()` which already fetches `pricing_mode` along with other settings.

## Findings
- Location: `src/lib/services/pricing.ts:99-110`
- Never imported anywhere (verified via grep)
- Subset of `getCourierPricingSettings()` - duplication of DB query

## Proposed Solutions

### Option 1: Delete the function (Recommended)
- **Pros**: Removes dead code, simplifies API surface, reduces confusion
- **Cons**: None - if needed in future, trivial to recreate from `getCourierPricingSettings()`
- **Effort**: Small
- **Risk**: Low (no callers exist)

## Recommended Action
Delete lines 99-110 from `pricing.ts`. Callers should use `getCourierPricingSettings()` and access `.pricingMode` property.

## Technical Details
- **Affected Files**: `src/lib/services/pricing.ts`
- **Related Components**: None (function is unused)
- **Database Changes**: No

## Resources
- Original finding: Code audit - dead code analysis
- Related issues: None

## Acceptance Criteria
- [ ] Function deleted from pricing.ts
- [ ] No TypeScript errors
- [ ] Code review approved

## Work Log

### 2026-01-28 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

## Notes
Source: Triage session on 2026-01-28
