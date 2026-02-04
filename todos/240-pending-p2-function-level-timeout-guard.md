---
status: pending
priority: p2
issue_id: "240"
tags: [code-review, pr-14, performance, edge-function, timeout]
dependencies: []
---

# Function-Level Timeout Guard Missing

## Problem Statement

The current retry logic can exceed the Supabase Edge Function 60-second timeout in mixed scenarios (timeouts + Retry-After headers combined). While the comment claims ~44s worst case, a specific combination can reach ~71s.

**Why it matters:**
- Free tier has 60s execution limit
- Function termination mid-execution loses work
- No graceful handling when approaching limit
- Silent failure from Supabase's perspective

## Findings

**Location:** `supabase/functions/send-email/index.ts:584` (comment)

**Current comment:**
```typescript
// Worst-case: 4 attempts × 10s timeout + ~4s backoff = ~44s (safe for free tier 60s limit)
```

**Actual worst case (mixed scenario):**
```
Attempt 0: 10s timeout → 10.3s wait (Retry-After: 10)
Attempt 1: 10s timeout → 10.3s wait (Retry-After: 10)
Attempt 2: 10s timeout → 10.3s wait (Retry-After: 10)
Attempt 3: 10s timeout
Total: 40s + 30.9s = 70.9s > 60s LIMIT EXCEEDED
```

**When this happens:**
- Resend server is slow to respond (hits 10s timeout)
- Resend also returns 429 with Retry-After: 10
- All 4 attempts follow this pattern

## Proposed Solutions

### Option A: Global Timeout Check (Recommended)
**Pros:** Guaranteed to stay within limits
**Cons:** Adds complexity
**Effort:** Small
**Risk:** Low

```typescript
// At handler start
const functionStartTime = Date.now();
const FUNCTION_TIMEOUT_MS = 55000; // 5s safety margin

// In fetchWithRetry, before each retry:
if (Date.now() - functionStartTime > FUNCTION_TIMEOUT_MS) {
  console.log('[send-email] Function timeout approaching, aborting retries');
  throw new Error('Function timeout limit approaching');
}
```

### Option B: Reduce Per-Request Timeout
**Pros:** Simpler, no new parameters
**Cons:** May cause premature timeouts on slow networks
**Effort:** Small
**Risk:** Low

```typescript
// Change from 10s to 8s
const resendResponse = await fetchWithRetry(
  "https://api.resend.com/emails",
  { ... },
  3,      // maxRetries
  8000    // 8s timeout (was 10s)
);
```

**Calculation:** 4 × 8s + 4 × 10.3s = 32s + 41.2s = 73.2s (still over!)

This option doesn't fully solve the problem.

### Option C: Limit Total Retry Time
**Pros:** Simple conceptually
**Cons:** Requires refactoring fetchWithRetry signature
**Effort:** Medium
**Risk:** Low

Add a `maxTotalTimeMs` parameter to fetchWithRetry.

## Recommended Action

Implement Option A - it's the most robust solution with minimal change.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Lines:** 127-215 (fetchWithRetry), 456+ (handler)
- **New parameter:** Pass `functionStartTime` to fetchWithRetry

## Acceptance Criteria

- [ ] Add function start time tracking
- [ ] Check elapsed time before each retry attempt
- [ ] Abort gracefully when approaching 55s
- [ ] Log when aborting due to timeout
- [ ] Update comment with accurate worst-case calculation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #14 performance review | Retry delays compound in unexpected ways |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- Supabase Edge Function Limits: https://supabase.com/docs/guides/functions/limits
