---
status: complete
priority: p3
issue_id: "119"
tags: [code-quality, svelte5, code-review]
dependencies: []
---

# querySelector DOM Manipulation for Email Toggle Auto-Submit

## Problem Statement
`NotificationsTab.svelte:188-192` uses `document.querySelector` to find the form and hidden input for auto-submit on email toggle. This is imperative DOM manipulation instead of idiomatic Svelte refs.

## Findings
- Location: `src/routes/courier/settings/NotificationsTab.svelte:188-192`
- `document.querySelector('form[action="?/updateNotificationPreferences"]')` is fragile (breaks if multiple forms match)
- Line 188 actually matches the FIRST form with that action, which may not be the email form

## Proposed Solutions

### Option 1: Use Svelte `bind:this` for form ref
- Bind form element to a variable, call `formRef.requestSubmit()` directly
- **Pros**: Idiomatic Svelte, no fragile selectors, type-safe
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Replace querySelector with `bind:this={formRef}` and direct `formRef.requestSubmit()`.

## Technical Details
- **Affected Files**: `src/routes/courier/settings/NotificationsTab.svelte`
- **Database Changes**: No

## Acceptance Criteria
- [ ] No `document.querySelector` usage for form submission
- [ ] Email toggle auto-submit still works correctly

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Second sweep code review of commit 158e99d
