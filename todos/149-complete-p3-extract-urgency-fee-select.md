---
status: complete
priority: p3
issue_id: "149"
tags: [frontend, code-duplication, components]
dependencies: []
---

# Extract Shared UrgencyFeeSelect Component

## Problem Statement
The urgency fee `<select>` with identical classes, option rendering (fee.name with multiplier/flat_fee display), and binding is duplicated across 3 files.

## Findings
- Source: Pattern Recognition Specialist (full review 2026-01-27)
- Locations:
  - `src/routes/courier/services/+page.svelte:406-423`
  - `src/routes/courier/services/[id]/edit/+page.svelte:246-265`
  - `src/routes/client/new/+page.svelte:256-273`

## Proposed Solutions

### Option 1: Create UrgencyFeeSelect.svelte
- Props: fees array, selectedFeeId (bindable)
- Renders styled select with fee name + rate display
- **Effort**: Small (20 minutes)
- **Risk**: Low

## Acceptance Criteria
- [ ] `$lib/components/UrgencyFeeSelect.svelte` created
- [ ] All 3 files use the shared component
