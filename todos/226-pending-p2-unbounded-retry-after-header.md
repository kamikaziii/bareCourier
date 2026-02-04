---
status: pending
priority: p2
issue_id: "226"
tags: [code-review, pr-14, security, performance]
dependencies: []
---

# Unbounded `retry-after` Header Can Cause Extended Blocking

## Problem Statement

The `fetchWithRetry()` function in PR #14 uses the `retry-after` header from Resend API without validation. A malicious or misconfigured upstream server could send an extremely large value (e.g., `retry-after: 86400` = 24 hours), causing the Edge Function to block for an extended period.

**Why it matters:**
- Resource exhaustion: Edge Function worker blocked indefinitely
- Denial of Service: User requests hang until timeout
- Potential billing impact on Supabase Edge Functions
- Supabase Edge Functions have 60s (free) / 150s (extended) execution limits

## Findings

**Location:** `supabase/functions/send-email/index.ts`, lines 139-143

**Current code:**
```typescript
const retryAfterHeader = response.headers.get("retry-after");
const parsedRetryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
const baseDelay = !isNaN(parsedRetryAfter)
  ? parsedRetryAfter * 1000  // No cap!
  : Math.pow(2, attempt) * 500;
```

**Risk:** If Resend sends `retry-after: 3600` (1 hour), the function will wait 1 hour before retrying.

## Proposed Solutions

### Option A: Cap the retry-after delay (Recommended)
**Pros:** Simple, minimal code change
**Cons:** May not respect server's intended delay
**Effort:** Small
**Risk:** Very Low

```typescript
const MAX_RETRY_DELAY_MS = 10000; // 10 seconds max

const baseDelay = !isNaN(parsedRetryAfter)
  ? Math.min(parsedRetryAfter * 1000, MAX_RETRY_DELAY_MS)
  : Math.pow(2, attempt) * 500;
```

### Option B: Add total deadline for all retries
**Pros:** Prevents runaway execution regardless of individual delays
**Cons:** More complex implementation
**Effort:** Medium
**Risk:** Low

```typescript
const deadline = Date.now() + 45000; // 45s total

// In retry loop:
const delay = Math.min(baseDelay + jitter, deadline - Date.now());
if (delay <= 0) throw new Error("Retry deadline exceeded");
```

## Recommended Action

Implement Option A (cap at 10 seconds). This is a simple fix that prevents the worst-case scenario while still respecting reasonable retry-after values from Resend.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Related constants:** MAX_RETRY_DELAY_MS
- **Supabase limits:** 60s free tier, 150s extended

## Acceptance Criteria

- [ ] Add MAX_RETRY_DELAY_MS constant (10000)
- [ ] Cap retry-after delay with Math.min()
- [ ] Add comment explaining why cap exists
- [ ] Test with artificially large retry-after header (manual)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 code review | Multiple agents flagged this issue |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- RFC 7231 Retry-After header: https://httpwg.org/specs/rfc7231.html#header.retry-after
- Supabase Edge Function limits: https://supabase.com/docs/guides/functions
