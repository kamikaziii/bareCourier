---
status: ready
priority: p3
issue_id: "093"
tags: [frontend, a11y]
dependencies: []
---

# Div with Click Handlers (Accessibility)

## Problem Statement
Div element with onclick/onkeydown handlers instead of semantic button/anchor.

## Findings
- Location: `src/routes/courier/+page.svelte:398`
- Using svelte-ignore comment for a11y_no_static_element_interactions
- Should use semantic element

## Proposed Solutions

### Option 1: Use semantic element
- **Pros**: Better accessibility
- **Cons**: May need styling adjustments
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Use <button> or <a> instead of <div> with click handlers

## Technical Details
- **Affected Files**: src/routes/courier/+page.svelte
- **Database Changes**: No

## Acceptance Criteria
- [ ] Semantic element used
- [ ] svelte-ignore comment removed
- [ ] Functionality preserved

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (frontend warning)
