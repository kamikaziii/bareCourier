# Notification & Email Gaps Fix Plan

**Branch:** `fix/notification-email-gaps`
**Worktree:** `.worktrees/fix/notification-email-gaps`
**Created:** 2026-02-04
**Status:** ✅ Implemented (awaiting commit)

---

## Problem Summary

The notification system has critical gaps where:
1. Some email templates exist but are never used
2. Some notification scenarios have no email template at all
3. Database triggers only create in-app notifications (no push/email)
4. Cron jobs for scheduled notifications were never set up
5. Translation strings incorrectly suggest "morning" for a configurable time

---

## Findings

### 1. Cron Job Not Scheduled

**Location:** `supabase/migrations/20260121000032_setup_notification_cron_jobs.sql`

All cron commands are commented out. Manual setup was required but never completed.

**Action Required:** Document and execute manual setup steps or create idempotent migration.

---

### 2. Translation Fixes

**Files:** `messages/en.json`, `messages/pt-PT.json`

| Key | Current | Should Be |
|-----|---------|-----------|
| `settings_daily_summary_desc` | "Receive a morning summary..." | "Receive a scheduled summary..." |
| `settings_category_daily_summary_desc` | "Morning overview..." | "Scheduled overview..." |

---

### 3. Email Template Usage Matrix

| Template | Exists | Used | Action |
|----------|--------|------|--------|
| `new_request` | ✅ | ❌ | Connect to dispatch |
| `delivered` | ✅ | ❌ | Connect to dispatch |
| `request_accepted` | ✅ | ✅ | None |
| `request_rejected` | ✅ | ✅ | None |
| `request_suggested` | ✅ | ✅ | None |
| `request_cancelled` | ✅ | ✅ | None |
| `daily_summary` | ❌ | N/A | Create template |
| `past_due` | ❌ | N/A | Create template |
| `suggestion_accepted` | ❌ | N/A | Create template |
| `suggestion_declined` | ❌ | N/A | Create template |

---

### 4. Notification Dispatch Gaps

#### 4.1 Client Creates Request → Courier
- **Current:** DB trigger creates in-app notification only
- **Fix:** Replace trigger with server action that calls `notifyCourier()` with `emailTemplate: 'new_request'`
- **Location:** `src/routes/client/new/+page.server.ts`

#### 4.2 Courier Marks Delivered → Client
- **Current:** DB trigger creates in-app notification only
- **Fix:** Add `notifyClient()` call with `emailTemplate: 'delivered'`
- **Locations:**
  - `src/routes/courier/services/[id]/+page.server.ts` (single)
  - `src/routes/courier/services/+page.server.ts` (batch)

#### 4.3 Client Accepts Suggestion → Courier
- **Current:** In-app notification only (via `notifyCourier`)
- **Fix:** Add email template `suggestion_accepted`, include in dispatch
- **Location:** `src/routes/client/+page.server.ts:acceptSuggestion`

#### 4.4 Client Declines Suggestion → Courier
- **Current:** In-app notification only (via `notifyCourier`)
- **Fix:** Add email template `suggestion_declined`, include in dispatch
- **Location:** `src/routes/client/+page.server.ts:declineSuggestion`

#### 4.5 Daily Summary → Courier
- **Current:** No email sent (missing `emailTemplate` in dispatch)
- **Fix:** Create `daily_summary` template, add to dispatch
- **Location:** `supabase/functions/daily-summary/index.ts`

#### 4.6 Past Due Alert → Courier
- **Current:** No email sent (missing `emailTemplate` in dispatch)
- **Fix:** Create `past_due` template, add to dispatch
- **Location:** `supabase/functions/check-past-due/index.ts`

---

## Implementation Tasks

### Phase 1: Critical - Fix Breaking Functionality ✅
- [x] 1.1 Create missing RPC functions: `reschedule_service`, `client_approve_reschedule`, `client_deny_reschedule`
- [x] 1.2 Fix DST timing bug (change tolerance from 7 to 14 minutes)
- [x] 1.3 Enable cron jobs migration

### Phase 2: Connect Unused Email Templates ✅
- [x] 2.1 Add `notifyCourier()` to `client/new/+page.server.ts` with `new_request` template
- [x] 2.2 Add `notifyClient()` to single service update with `delivered` template
- [x] 2.3 Add `notifyClient()` to batch service update with `delivered` template

### Phase 3: Create Missing Email Templates ✅
- [x] 3.1 Add `daily_summary` template to `send-email/index.ts`
- [x] 3.2 Add `past_due` template to `send-email/index.ts`
- [x] 3.3 Add `suggestion_accepted` template to `send-email/index.ts`
- [x] 3.4 Add `suggestion_declined` template to `send-email/index.ts`
- [x] 3.5 Add all required email translation keys to `email-translations.ts`
- [x] 3.6 Add email template to `daily-summary/index.ts` dispatch
- [x] 3.7 Add email template to `check-past-due/index.ts` dispatch

### Phase 4: Add Suggestion Response Emails ✅
- [x] 4.1 Add email template to `acceptSuggestion` action (single + batch)
- [x] 4.2 Add email template to `declineSuggestion` action (single + batch)

### Phase 5: Translation Fixes ✅
- [x] 5.1 Fix `settings_daily_summary_desc` in EN and PT-PT
- [x] 5.2 Fix `settings_category_daily_summary_desc` in EN and PT-PT

---

## Testing Checklist

- [ ] New service request: Courier receives in-app + push + email
- [ ] Mark delivered: Client receives in-app + push + email
- [ ] Accept suggestion: Courier receives in-app + push + email
- [ ] Decline suggestion: Courier receives in-app + push + email
- [ ] Daily summary: Courier receives in-app + email (push per settings)
- [ ] Past due: Courier receives in-app + push + email
- [ ] All email templates render correctly in email client

---

## Dependencies

- Resend API key configured in Supabase secrets
- Vault secrets for cron job (project_url, service_role_key)
- pg_cron and pg_net extensions enabled

---

## Notes

- Consider adding retry logic with exponential backoff for Resend (see XPace pattern)
- All notifications respect user preferences (quiet hours, working days, category toggles)
- Email-only vs push-only is configurable per category in settings
