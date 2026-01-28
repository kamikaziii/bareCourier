---
status: ready
priority: p3
issue_id: "159"
tags: [duplication, consolidation, status]
dependencies: []
---

# Consolidate Duplicate `getStatusLabel()` Functions

## Problem Statement
`getStatusLabel()` is defined identically in two files, creating maintenance risk and inconsistency. When logic changes, both copies must be updated.

## Findings
- Location 1: `src/lib/utils/status.ts:6-8` (canonical)
- Location 2: `src/lib/services/insights-data.ts:235-237` (duplicate)
- Both functions are identical
- Duplication creates divergence risk

## Proposed Solutions

### Option 1: Delete from insights-data, import from status.ts (Recommended)
- **Pros**: Single source of truth, easier maintenance, consistent behavior
- **Cons**: Requires import change
- **Effort**: Small
- **Risk**: Low (simple import refactor)

## Recommended Action
1. Remove `getStatusLabel()` function from `insights-data.ts:235-237`
2. Add import: `import { getStatusLabel } from '$lib/utils/status.js'`
3. Update `exportServicesToCSV()` to use imported function

## Technical Details
- **Affected Files**:
  - `src/lib/utils/status.ts` (source of truth)
  - `src/lib/services/insights-data.ts` (remove duplicate)
- **Related Components**: CSV export functionality
- **Database Changes**: No

## Resources
- Original finding: Code audit - duplication analysis
- Related issues: None

## Acceptance Criteria
- [ ] Duplicate removed from insights-data.ts
- [ ] Import added to insights-data.ts
- [ ] No TypeScript errors
- [ ] CSV export still works correctly
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
