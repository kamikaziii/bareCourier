---
status: complete
priority: p2
issue_id: "229"
tags: [code-review, pr-14, performance]
dependencies: []
---

# 30s Timeout × 4 Attempts May Exceed Edge Function Limits

## Problem Statement

The current retry configuration can result in execution times that exceed Supabase Edge Function limits:

- Max retries: 3 (4 total attempts)
- Timeout per request: 30 seconds
- Backoff: 500ms, 1s, 2s base + 0-300ms jitter

**Worst-case calculation:**
```
Attempt 1: 30s timeout + 500ms + 300ms jitter = ~30.8s
Attempt 2: 30s timeout + 1000ms + 300ms jitter = ~31.3s
Attempt 3: 30s timeout + 2000ms + 300ms jitter = ~32.3s
Attempt 4: 30s timeout = 30s
Total: ~124.4 seconds
```

**Why it matters:**
- Supabase free tier limit: 60 seconds
- Supabase extended plan limit: 150 seconds
- Worst-case of 124 seconds exceeds free tier by 2x

## Findings

**Location:** `supabase/functions/send-email/index.ts`

**Current configuration:**
```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,        // 4 total attempts
  timeoutMs = 30000      // 30 seconds each
): Promise<Response>
```

**Reality check:** Resend's API typically responds in under 2 seconds. A 30-second timeout is generous but could be problematic in edge cases.

## Proposed Solutions

### Option A: Reduce per-request timeout (Recommended)
**Pros:** Simple fix, reduces worst-case significantly
**Cons:** May fail legitimate slow responses (rare)
**Effort:** Small
**Risk:** Very Low

```typescript
const resendResponse = await fetchWithRetry(
  "https://api.resend.com/emails",
  options,
  3,       // maxRetries
  10000    // 10s timeout instead of 30s
);
```

New worst-case: ~44 seconds (safe for free tier)

### Option B: Add total deadline
**Pros:** Hard cap on total execution time
**Cons:** More complex implementation
**Effort:** Medium
**Risk:** Low

```typescript
const deadline = Date.now() + 45000; // 45s total deadline

// In retry loop:
if (Date.now() > deadline) throw new Error("Retry deadline exceeded");
```

### Option C: Reduce max retries to 2
**Pros:** Simple, reduces total attempts to 3
**Cons:** Less resilience to transient failures
**Effort:** Small
**Risk:** Low

Worst-case with 2 retries + 30s timeout: ~93 seconds

## Recommended Action

Implement Option A (reduce timeout to 10 seconds). Resend's API is fast, and 10 seconds is still generous. Combine with Option B (45s deadline) for extra safety.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Supabase free tier:** 60s limit
- **Supabase extended tier:** 150s limit
- **Resend API typical response:** <2 seconds

## Acceptance Criteria

- [ ] Reduce per-request timeout from 30s to 10s
- [ ] Consider adding total deadline (45s)
- [ ] Add comment documenting worst-case execution time
- [ ] Test retry behavior still works correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 performance review | Edge function timeouts are easy to exceed |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- Supabase Edge Function limits: https://supabase.com/docs/guides/functions
