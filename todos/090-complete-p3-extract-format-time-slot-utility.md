---
status: ready
priority: p3
issue_id: "090"
tags: [frontend, dry]
dependencies: []
---

# formatTimeSlot Duplicated in 2 Client Pages

## Problem Statement
formatTimeSlot function duplicated in client/+page.svelte and client/services/[id]/+page.svelte.

## Findings
- Location:
  - src/routes/client/+page.svelte:100
  - src/routes/client/services/[id]/+page.svelte:25
- Same logic duplicated

## Proposed Solutions

### Option 1: Extract to $lib/utils.js
- **Pros**: DRY, single source of truth
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Extract formatTimeSlot to $lib/utils.ts and import in both files

## Technical Details
- **Affected Files**: src/lib/utils.ts, 2 page files
- **Database Changes**: No

## Acceptance Criteria
- [ ] formatTimeSlot in $lib/utils.ts
- [ ] Both pages import from utils

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (frontend warning)
