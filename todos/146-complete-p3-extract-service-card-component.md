---
status: complete
priority: p3
issue_id: "146"
tags: [frontend, code-duplication, components]
dependencies: ["145"]
---

# Extract Shared ServiceCard Component

## Problem Statement
Service list item rendering (status dot, client name/route, status badge, scheduled date, notes, created_at) is structurally identical across 3 files.

## Findings
- Source: Pattern Recognition Specialist (full review 2026-01-27)
- Locations:
  - `src/routes/courier/+page.svelte`
  - `src/routes/courier/services/+page.svelte`
  - `src/routes/client/+page.svelte`

## Proposed Solutions

### Option 1: Create ServiceCard.svelte
- Props: service, showClientName, selectable, selected, onToggle
- Handles status dot, badge, date, notes display
- Courier and client pages use it with role-specific props
- **Effort**: Medium (1-2 hours)
- **Risk**: Low

## Acceptance Criteria
- [ ] `$lib/components/ServiceCard.svelte` created
- [ ] All 3 list views use the shared component
- [ ] Visual output unchanged
