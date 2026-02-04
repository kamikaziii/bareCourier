---
status: complete
priority: p3
issue_id: "225"
tags: [observability, code-review, notifications, pr-13]
dependencies: []
---

# No Email Delivery Status Observability

## Problem Statement

When emails are sent via the `send-email` edge function, the Resend API returns an `email_id` and delivery status, but this information is not persisted. Neither users nor agents can query whether an email was actually sent or delivered for a notification.

**Impact:** No visibility into email delivery failures; debugging requires manual Resend dashboard access; no way to retry failed emails.

## Findings

**Location:** `supabase/functions/send-email/index.ts` lines 588-596

```typescript
const resendResponse = await res.json();
return new Response(
    JSON.stringify({
        message: "Email sent successfully",
        email_id: resendResponse.id,  // This ID is never stored!
    }),
    { status: 200 }
);
```

**Current State:**
- `notifications` table tracks in-app notifications
- No record of email send attempts or results
- Push notification status also not tracked

## Proposed Solutions

### Option A: Add Columns to Notifications Table (Minimum)

```sql
ALTER TABLE notifications ADD COLUMN email_sent_at timestamptz;
ALTER TABLE notifications ADD COLUMN email_id text;
ALTER TABLE notifications ADD COLUMN email_status text; -- queued, sent, delivered, bounced
ALTER TABLE notifications ADD COLUMN push_sent_at timestamptz;
```

Update `dispatchNotification` to record email send results.

**Pros:** Simple, uses existing table
**Cons:** Not all notifications have email/push
**Effort:** Small
**Risk:** Low

### Option B: Create Dedicated Email Log Table

```sql
CREATE TABLE email_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid REFERENCES notifications(id),
    email_id text, -- Resend ID
    recipient text NOT NULL,
    template text NOT NULL,
    status text DEFAULT 'queued',
    sent_at timestamptz,
    delivered_at timestamptz,
    bounced_at timestamptz,
    error_message text,
    created_at timestamptz DEFAULT now()
);
```

**Pros:** Detailed tracking, supports webhooks
**Cons:** More infrastructure
**Effort:** Medium
**Risk:** Low

### Option C: Implement Resend Webhooks

Configure Resend to POST delivery events back to an edge function:

```typescript
// supabase/functions/resend-webhook/index.ts
// Handles: email.sent, email.delivered, email.bounced, email.complained
```

**Pros:** Real-time status updates, accurate delivery tracking
**Cons:** Requires webhook endpoint, more complexity
**Effort:** Medium
**Risk:** Low

## Technical Details

**Affected Files:**
- `supabase/functions/send-email/index.ts`
- `supabase/functions/_shared/notify.ts` (dispatchNotification)
- New migration for table changes

**Resend Webhook Events:**
- `email.sent` - Email accepted by Resend
- `email.delivered` - Email delivered to recipient's server
- `email.bounced` - Email bounced
- `email.complained` - Recipient marked as spam

## Acceptance Criteria

- [ ] Email send results are persisted (at minimum: email_id, sent_at)
- [ ] Failed emails can be identified and retried
- [ ] API or query available to check notification delivery status

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #13 code review | Agent-native reviewer identified observability gap |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
- Resend Webhooks: https://resend.com/docs/dashboard/webhooks/introduction
