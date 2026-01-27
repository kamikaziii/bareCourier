---
status: complete
priority: p2
issue_id: "144"
tags: [frontend, code-duplication, refactor]
dependencies: []
---

# Extract Shared Batch Selection Composable

## Problem Statement
toggleSelectionMode, toggleSelection, selectAllVisible, selectedCount, hasSelection, and selection toolbar UI are near-identical across 3 files.

## Findings
- Source: Pattern Recognition Specialist (full review 2026-01-27)
- Locations:
  - `src/routes/courier/+page.svelte`
  - `src/routes/courier/services/+page.svelte`
  - `src/routes/courier/requests/+page.svelte`

## Proposed Solutions

### Option 1: Extract composable function
- Create `$lib/composables/use-batch-selection.ts`
- Returns `{ selectionMode, selectedIds, toggle, selectAll, deselectAll, selectedCount, hasSelection }`
- Each page passes item list and uses returned state
- **Effort**: Medium (1-2 hours)
- **Risk**: Low

## Acceptance Criteria
- [ ] Shared composable in `$lib/composables/use-batch-selection.ts`
- [ ] All 3 files use the shared composable
- [ ] Selection toolbar extracted or simplified
