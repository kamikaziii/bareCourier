---
status: ready
priority: p3
issue_id: "092"
tags: [frontend, consistency]
dependencies: []
---

# Inline SVGs Instead of Lucide Components

## Problem Statement
Multiple files use inline SVG icons instead of importing from @lucide/svelte.

## Findings
- Locations:
  - src/routes/courier/calendar/+page.svelte:173 - chevron icons
  - src/routes/courier/calendar/+page.svelte:342 - chevron-right
  - src/routes/courier/settings/PricingTab.svelte:342 - edit icon
  - src/lib/components/SchedulePicker.svelte:117 - calendar icon
  - src/routes/client/+page.svelte:272 - alert symbol

## Proposed Solutions

### Option 1: Import from @lucide/svelte
- **Pros**: Consistency, smaller bundle
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Import icons from @lucide/svelte for consistency

## Technical Details
- **Affected Files**: Multiple components
- **Database Changes**: No

## Acceptance Criteria
- [ ] All inline SVGs replaced with Lucide imports
- [ ] Consistent icon usage

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (frontend warning)
