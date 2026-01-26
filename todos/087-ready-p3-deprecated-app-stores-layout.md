---
status: ready
priority: p3
issue_id: "087"
tags: [frontend, svelte]
dependencies: []
---

# Using Deprecated $app/stores in Root Layout

## Problem Statement
Using deprecated $app/stores instead of $app/state in root layout.

## Findings
- Location: `src/routes/+layout.svelte:4`
- $app/stores is deprecated in Svelte 5
- Should use $app/state

## Proposed Solutions

### Option 1: Migrate to $app/state
- **Pros**: Uses modern API
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Change import from '$app/stores' to '$app/state'

## Technical Details
- **Affected Files**: src/routes/+layout.svelte
- **Database Changes**: No

## Acceptance Criteria
- [ ] Import updated to $app/state
- [ ] Usage updated appropriately

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (frontend warning)
