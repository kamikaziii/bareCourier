---
status: complete
priority: p3
issue_id: "147"
tags: [frontend, code-duplication, components]
dependencies: []
---

# Extract Shared StatusHistory Component

## Problem Statement
Status history timeline (colored dots, old_status -> new_status, timestamps) is nearly identical in courier and client detail views.

## Findings
- Source: Pattern Recognition Specialist (full review 2026-01-27)
- Locations:
  - `src/routes/courier/services/[id]/+page.svelte:454-492`
  - `src/routes/client/services/[id]/+page.svelte:376-411`

## Proposed Solutions

### Option 1: Create StatusHistory.svelte
- Props: statusHistory array
- Renders timeline with colored dots and transitions
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Acceptance Criteria
- [ ] `$lib/components/StatusHistory.svelte` created
- [ ] Both detail views use the shared component
