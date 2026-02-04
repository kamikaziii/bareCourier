---
status: complete
priority: p2
issue_id: "227"
tags: [code-review, pr-14, security, privacy, gdpr]
dependencies: []
---

# Email Address Logged in Success Message (PII Exposure)

## Problem Statement

The PR adds a success log that includes the target user's email address in plain text. In Supabase Edge Functions, logs are persisted and accessible via the dashboard and CLI, creating a PII (Personally Identifiable Information) exposure risk.

**Why it matters:**
- GDPR/privacy compliance risk: Email addresses are PII
- Log aggregation systems may store this data indefinitely
- Anyone with access to Supabase logs can see all recipient emails
- Violates data minimization principle

## Findings

**Location:** `supabase/functions/send-email/index.ts`, line 572

**Current code:**
```typescript
console.log(`[send-email] Email sent successfully to ${targetUser.email}, id: ${resendData.id}`);
```

**Example log output:**
```
[send-email] Email sent successfully to john.doe@example.com, id: email_abc123
```

## Proposed Solutions

### Option A: Use user_id instead of email (Recommended)
**Pros:** user_id is already available, not PII, sufficient for debugging
**Cons:** Requires joining auth.users if email is needed
**Effort:** Small
**Risk:** Very Low

```typescript
console.log(`[send-email] Email sent successfully to user ${user_id}, id: ${resendData.id}`);
```

### Option B: Mask the email
**Pros:** Some visibility while protecting PII
**Cons:** Partial exposure, not fully compliant
**Effort:** Small
**Risk:** Low

```typescript
const maskedEmail = targetUser.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
console.log(`[send-email] Email sent successfully to ${maskedEmail}, id: ${resendData.id}`);
// Output: "jo***@example.com"
```

### Option C: Remove email entirely
**Pros:** Zero PII in logs
**Cons:** Less debugging context
**Effort:** Small
**Risk:** Very Low

```typescript
console.log(`[send-email] Email sent successfully, id: ${resendData.id}`);
```

## Recommended Action

Implement Option A (use user_id). The `user_id` is already available in the function scope, is not PII, and provides sufficient context for debugging when correlated with the Resend email ID.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Variable available:** `user_id` from request body
- **GDPR Article:** 5(1)(c) - data minimization

## Acceptance Criteria

- [ ] Replace `targetUser.email` with `user_id` in success log
- [ ] Verify no other PII is logged in the function
- [ ] Test that log output is useful for debugging

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 security review | PII in logs is common oversight |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- Supabase logs access: https://supabase.com/docs/guides/functions/logs
- GDPR data minimization: https://gdpr-info.eu/art-5-gdpr/
