---
status: ready
priority: p2
issue_id: "112"
tags: [ux, architecture, code-review]
dependencies: []
---

# Dual Forms Sharing Mutable State in NotificationsTab

## Problem Statement
`NotificationsTab.svelte` has two separate forms (preferences matrix at line 210 and quiet hours at line 361) both serializing the full `notificationPrefs` reactive object via hidden inputs. Saving one form silently includes unsaved changes from the other, which is unintuitive.

## Findings
- Line 211: `<input type="hidden" name="notification_preferences" value={JSON.stringify(notificationPrefs)} />`
- Line 362: identical hidden input in quiet hours form
- Both POST to `?/updateNotificationPreferences`
- Changing a category checkbox then clicking save on quiet hours card submits the category change too

## Proposed Solutions

### Option 1: Merge into a single form with one save button
- **Pros**: Eliminates confusion, simpler code, fewer form elements
- **Cons**: Larger save scope (all-or-nothing)
- **Effort**: Small
- **Risk**: Low

### Option 2: Isolate state per form section
- **Pros**: Independent saves work as expected
- **Cons**: More state management, potential sync issues
- **Effort**: Medium
- **Risk**: Medium

## Recommended Action
Option 1: Merge preferences matrix and quiet hours into a single form with one save button.

## Technical Details
- **Affected Files**: `src/routes/courier/settings/NotificationsTab.svelte`
- **Database Changes**: No

## Acceptance Criteria
- [ ] No silent inclusion of unsaved changes from other sections
- [ ] User intent is clear when clicking save

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Code review of commit 158e99d
