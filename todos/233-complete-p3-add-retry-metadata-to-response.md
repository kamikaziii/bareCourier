---
status: complete
priority: p3
issue_id: "233"
tags: [code-review, pr-14, observability, agent-native]
dependencies: []
---

# Add Retry Metadata to API Response

## Problem Statement

The current response contract does not indicate whether retries occurred or how many attempts were made. This limits observability and makes it harder for automated callers to understand what happened.

**Why it matters:**
- Callers cannot distinguish "worked first try" from "worked after 3 retries"
- No visibility into transient issues
- Agents/cron jobs cannot make informed decisions about email health
- Debugging is harder without knowing retry count

## Findings

**Current response on success:**
```json
{ "success": true, "sent": true, "email_id": "..." }
```

**Current response on error:**
```json
{ "error": "Resend API error: ..." }
```

**Missing information:**
- Number of retry attempts
- Whether error was retryable
- Total time spent (including delays)

## Proposed Solutions

### Option A: Add retry_info object (Recommended)
**Pros:** Full observability, backward compatible
**Cons:** Slightly larger response
**Effort:** Small
**Risk:** Very Low

```json
// Success after retries
{
  "success": true,
  "sent": true,
  "email_id": "...",
  "retry_info": {
    "attempts": 2,
    "total_delay_ms": 850
  }
}

// Error after retries
{
  "success": false,
  "error": {
    "code": "quota_exceeded",
    "message": "Daily quota exceeded",
    "retryable": false
  },
  "retry_info": {
    "attempts": 4,
    "reason": "monthly_quota_exceeded"
  }
}
```

### Option B: Add minimal retry count
**Pros:** Simple, minimal change
**Cons:** Less detail
**Effort:** Small
**Risk:** Very Low

```json
{
  "success": true,
  "sent": true,
  "email_id": "...",
  "attempts": 2
}
```

## Recommended Action

Implement Option B as a quick win. Option A can be added later if more detail is needed.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Functions:** `fetchWithRetry()` needs to track attempts
- **Return type:** Add `attempts?: number` to response

## Acceptance Criteria

- [ ] Modify `fetchWithRetry` to return attempt count
- [ ] Include `attempts` in success response
- [ ] Include `attempts` in error response
- [ ] Update API documentation if exists

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 agent-native review | Observability benefits both humans and agents |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
