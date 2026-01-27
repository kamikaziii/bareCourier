---
status: complete
priority: p2
issue_id: "145"
tags: [frontend, code-duplication, refactor]
dependencies: []
---

# Extract Status Label/Color Utility Functions

## Problem Statement
`getStatusLabel`, `getRequestStatusLabel`, and `getRequestStatusColor` are defined identically across 4 files.

## Findings
- Source: Pattern Recognition Specialist (full review 2026-01-27)
- `getStatusLabel` duplicated in:
  - `src/routes/courier/+page.svelte:271`
  - `src/routes/courier/services/+page.svelte:300`
  - `src/routes/client/+page.svelte:115`
- `getRequestStatusLabel`/`getRequestStatusColor` duplicated in:
  - `src/routes/courier/services/[id]/+page.svelte:54-72`
  - `src/routes/client/+page.svelte:119-147`

## Proposed Solutions

### Option 1: Extract to $lib/utils/status.ts
- Move all status helper functions to shared module
- All pages import from single source
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Acceptance Criteria
- [ ] Status utils in `$lib/utils/status.ts`
- [ ] All files import from shared module
- [ ] No duplicated status functions remain
