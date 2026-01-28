---
status: ready
priority: p3
issue_id: "162"
tags: [dead-code, cleanup, utilities]
dependencies: []
---

# Delete Unused `formatDateShort()` Function

## Problem Statement
`formatDateShort()` was added speculatively in commit `18d8f01` as part of a batch of date utilities but was never imported or used anywhere in the codebase. Dead code since day one.

## Findings
- Location: `src/lib/utils.ts:33-40`
- Never imported in any `.svelte` or `.ts` file (verified via grep + git history)
- Added alongside other date utilities (`formatDate`, `formatDateTime`, etc.) which ARE used
- Simply never needed — speculative addition

## Proposed Solutions

### Option 1: Delete the function (Recommended)
- **Pros**: Removes dead code, reduces noise in utils module
- **Cons**: None — trivial to recreate if needed
- **Effort**: Small
- **Risk**: Low (no callers exist, verified across full git history)

## Recommended Action
Delete lines 33-40 from `src/lib/utils.ts`.

## Technical Details
- **Affected Files**: `src/lib/utils.ts`
- **Related Components**: None (function is unused)
- **Database Changes**: No

## Acceptance Criteria
- [ ] Function deleted from utils.ts
- [ ] No TypeScript errors
- [ ] Build passes

## Work Log

### 2026-01-28 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Verified dead code via grep and git history analysis
- Status: ready

## Notes
Source: Triage session on 2026-01-28
