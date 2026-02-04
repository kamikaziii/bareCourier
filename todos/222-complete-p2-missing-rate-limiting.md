---
status: complete
priority: p2
issue_id: "222"
tags: [code-review, security, rate-limiting, pr-15]
dependencies: []
---

# P2: Missing Rate Limiting on Invitation Emails

## Problem Statement

There is no rate limiting on invitation email sending. A malicious actor with courier credentials could abuse the system to spam email addresses or exhaust email service quotas.

**Why it matters:**
- Could be used to spam arbitrary email addresses
- Could exhaust Resend API quota
- Could get sending domain blacklisted

## Findings

**Location:** `supabase/functions/create-client/index.ts`

The function can be called repeatedly with `send_invitation: true` for any email address. There's no limit on:
- Invitations per email per time period
- Total invitations per courier per time period
- Resend frequency for the same email

## Proposed Solutions

### Option A: Track invitation timestamps in database (Recommended)
**Pros:** Persistent, works across function instances
**Cons:** Requires schema change
**Effort:** Medium
**Risk:** Low

```sql
-- Add to profiles or new table
ALTER TABLE profiles ADD COLUMN last_invitation_sent_at timestamptz;

-- Or create invitation_log table
CREATE TABLE invitation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  sent_by uuid REFERENCES auth.users NOT NULL,
  sent_at timestamptz DEFAULT now(),
  INDEX idx_invitation_log_email_sent (email, sent_at)
);
```

```typescript
// In create-client:
const { data: recentInvitation } = await adminClient
  .from("invitation_log")
  .select("sent_at")
  .eq("email", email)
  .gte("sent_at", new Date(Date.now() - 3600000).toISOString())  // 1 hour
  .single();

if (recentInvitation) {
  return new Response(
    JSON.stringify({ error: "Please wait before sending another invitation" }),
    { status: 429, ... }
  );
}
```

### Option B: Supabase Edge Function rate limiting
**Pros:** No code changes
**Cons:** Applies to all calls, not just invitations
**Effort:** Small (config only)
**Risk:** Low

### Option C: Client-side cooldown only
**Pros:** Simple
**Cons:** Easily bypassed
**Effort:** Small
**Risk:** Medium (not effective against abuse)

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `supabase/functions/create-client/index.ts`
- `supabase/migrations/` (if adding tracking table)

**Components affected:**
- Client invitation flow
- Resend invitation functionality

**Database changes:** May require new table or column

## Acceptance Criteria

- [x] Rate limit enforced (e.g., 1 invitation per email per hour)
- [x] Clear error message returned when rate limited
- [x] UI handles 429 response gracefully (existing error handling displays the message)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #15 review | Security agent flagged abuse potential |
| 2026-02-04 | Implemented in-memory rate limiting | Added 1-hour rate limit per email address. In-memory Map resets on cold start but provides basic protection. Existing UI error handling displays the rate limit message. |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
