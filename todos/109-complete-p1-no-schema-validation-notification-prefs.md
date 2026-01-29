---
status: complete
priority: p1
issue_id: "109"
tags: [security, data-integrity, code-review]
dependencies: []
---

# No Schema Validation on Notification Preferences JSON

## Problem Statement
The `updateNotificationPreferences` server action parses JSON from form data and stores it directly in the `notification_preferences` JSONB column with zero schema validation. Any valid JSON is accepted - malformed structures, missing fields, or garbage data would corrupt the record and break the notification dispatcher.

## Findings
- Location: `src/routes/courier/settings/+page.server.ts:289-292`
- `JSON.parse(notificationPrefsJson)` result is assigned directly to `updateData.notification_preferences`
- No validation of structure, types, or values
- Dispatcher at `notify.ts:109` reads `prefs.categories[category]` which would crash on malformed data

## Proposed Solutions

### Option 1: Manual runtime validation function
- **Pros**: No new dependencies, small footprint
- **Cons**: Verbose, must maintain manually
- **Effort**: Small
- **Risk**: Low

### Option 2: Zod schema validation
- **Pros**: Type-safe, composable, good error messages
- **Cons**: New dependency
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Add a `validateNotificationPreferences()` function in the server action that checks: all 5 categories have boolean `inApp`/`push`/`email`, quietHours has `enabled` boolean and valid `HH:MM` strings, `workingDaysOnly` is boolean. Reject with error if invalid.

## Technical Details
- **Affected Files**: `src/routes/courier/settings/+page.server.ts`
- **Related Components**: NotificationsTab.svelte, notify.ts dispatcher
- **Database Changes**: No

## Acceptance Criteria
- [ ] Malformed JSON preferences are rejected with descriptive error
- [ ] Valid preferences are stored correctly
- [ ] Missing/extra fields are rejected
- [ ] Invalid time formats in quietHours are rejected

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes
Source: Code review of commit 158e99d (notification center)
