---
status: complete
priority: p1
issue_id: "335"
tags: [bug, database, triggers, ui, code-review]
dependencies: ["334"]
---

# Client timezone update broken — trigger blocks it but UI renders the form

## Problem Statement

Migration 000003 blocks clients from modifying `timezone` (line 143-145), but the `NotificationsTab.svelte` component renders a timezone selector for ALL roles (no conditional rendering). When a client changes their timezone via the settings page, the DB trigger raises an exception and the user sees a 500 error toast.

## Findings

- `NotificationsTab.svelte` lines 571-612: Timezone card with `<form action="?/updateTimezone">` — renders unconditionally for all roles
- `client/settings/+page.svelte` lines 129 and 155: Renders `<NotificationsTab role="client" ...>` — confirms clients see this form
- `client/settings/+page.server.ts` lines 178-201: `updateTimezone` action calls `supabase.from('profiles').update({ timezone })` — will be blocked by trigger
- Migration 000003 line 143: `IF NEW.timezone IS DISTINCT FROM OLD.timezone THEN RAISE EXCEPTION`
- Review agents incorrectly called this "dead code" — the UI actively renders it

**Location:**
- Trigger: `supabase/migrations/20260213000003_add_profile_update_trigger.sql:143-145`
- UI: `src/lib/components/NotificationsTab.svelte:571-612`
- Action: `src/routes/client/settings/+page.server.ts:178-201`

## Proposed Solutions

### Option 1: Allow clients to change timezone (Recommended)
Remove the timezone check from the trigger (lines 143-145). Timezone is a user preference, not a security-sensitive field.
- **Pros**: Fixes the bug, timezone is a legitimate client preference
- **Cons**: None — timezone has no security implications
- **Effort**: Small
- **Risk**: Low

### Option 2: Hide timezone form from clients
Add `{#if role === "courier"}` around the timezone card in NotificationsTab.svelte.
- **Pros**: No DB changes needed
- **Cons**: Clients lose timezone customization
- **Effort**: Small
- **Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Technical Details
- **Affected Files**: Migration 000003, NotificationsTab.svelte, client/settings/+page.server.ts
- **Related Components**: Client settings page, notification preferences
- **Database Changes**: Yes (if Option 1) — remove timezone from trigger denylist

## Acceptance Criteria
- [ ] Client can change timezone without error OR timezone form is hidden from clients
- [ ] No regression for courier timezone settings

## Work Log

### 2026-02-13 - Discovered during manual verification
**By:** Claude Code Review (verification pass)
**Actions:**
- All 6 review agents called this "dead code" but it's actively rendered in the UI
- Verified NotificationsTab.svelte has no role-based conditional around timezone section
- Verified client/settings/+page.svelte renders NotificationsTab with role="client"

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
