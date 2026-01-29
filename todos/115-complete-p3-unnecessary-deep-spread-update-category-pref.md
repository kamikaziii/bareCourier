---
status: complete
priority: p3
issue_id: "115"
tags: [code-quality, svelte5, code-review]
dependencies: []
---

# Unnecessary Deep Spread in updateCategoryPref

## Problem Statement
The `updateCategoryPref` function at `NotificationsTab.svelte:69-78` uses a 16-line nested spread pattern to update a single boolean. Svelte 5 `$state` creates deep reactive proxies, so direct mutation works and is idiomatic.

## Findings
- Location: `src/routes/courier/settings/NotificationsTab.svelte:69-78`
- 4 levels of object spreading for a single property change
- Svelte 5 docs confirm `$state` objects are deeply reactive proxies that track property mutations

## Proposed Solutions

### Option 1: Direct property mutation
- Replace with: `notificationPrefs.categories[category][channel] = value;`
- **Pros**: 1 line instead of 16, idiomatic Svelte 5
- **Cons**: None - confirmed by official Svelte 5 docs
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Replace the function body with direct property assignment.

## Technical Details
- **Affected Files**: `src/routes/courier/settings/NotificationsTab.svelte`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Checkbox toggles still update the hidden input JSON correctly
- [ ] Form submission sends correct preferences

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Code review of commit 158e99d. Verified against official Svelte 5 $state documentation.
