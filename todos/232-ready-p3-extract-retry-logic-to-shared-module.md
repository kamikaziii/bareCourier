---
status: ready
priority: p3
issue_id: "232"
tags: [code-review, pr-14, architecture, refactor]
dependencies: []
---

# Extract Retry Logic to Shared Module

## Problem Statement

The `fetchWithRetry()` function is generic HTTP infrastructure that's currently embedded in `send-email/index.ts`. This violates the Single Responsibility Principle and limits reusability.

**Why it matters:**
- `send-email/index.ts` now handles 7 distinct responsibilities (589 lines)
- Retry logic could benefit `send-push` and future integrations
- Hardcoded configuration reduces operational flexibility
- No testability path for the retry logic in isolation

## Findings

**Current structure:**
```
supabase/functions/
├── _shared/
│   ├── notify.ts
│   ├── translations.ts
│   └── email-translations.ts
├── send-email/
│   └── index.ts  (589 lines, 7 responsibilities)
└── send-push/
    └── index.ts  (no retry logic)
```

**Responsibilities in send-email/index.ts:**
1. CORS handling (18-31)
2. Auth validation (33-45)
3. HTML escaping (57-68)
4. Email template generation (70-307)
5. IDOR protection (391-410)
6. **Retry with backoff (NEW)** (70-183)
7. Request orchestration (309-475)

## Proposed Solutions

### Option A: Extract to _shared/http.ts (Recommended)
**Pros:** Reusable, testable, follows existing patterns
**Cons:** Requires refactor
**Effort:** Medium
**Risk:** Low

```
supabase/functions/
├── _shared/
│   ├── http/
│   │   ├── retry.ts         # fetchWithRetry, RetryConfig
│   │   └── index.ts
│   ├── resend/
│   │   ├── client.ts        # isRetryableRateLimit (Resend-specific)
│   │   └── index.ts
│   ├── notify.ts
│   └── translations.ts
├── send-email/
│   └── index.ts             # Now ~400 lines
```

### Option B: Make config environment-based
**Pros:** Operational flexibility without refactor
**Cons:** Doesn't address testability
**Effort:** Small
**Risk:** Very Low

```typescript
const RETRY_CONFIG = {
  maxRetries: parseInt(Deno.env.get("EMAIL_MAX_RETRIES") || "3"),
  timeoutMs: parseInt(Deno.env.get("EMAIL_TIMEOUT_MS") || "30000"),
  baseDelayMs: parseInt(Deno.env.get("EMAIL_BASE_DELAY_MS") || "500"),
};
```

### Option C: Accept current structure
**Pros:** No changes needed
**Cons:** Technical debt accumulates
**Effort:** None
**Risk:** N/A (deferred)

## Recommended Action

Start with Option B (env-based config) as a quick win, then plan Option A for a future refactor sprint.

## Technical Details

- **Affected files:**
  - `supabase/functions/send-email/index.ts`
  - New: `supabase/functions/_shared/http/retry.ts`
- **Functions to extract:** `fetchWithRetry`, retry config
- **Keep in send-email:** `isRetryableRateLimit` (Resend-specific)

## Acceptance Criteria

- [ ] Create `_shared/http/retry.ts` with `fetchWithRetry`
- [ ] Export retry config as constants
- [ ] Import into `send-email/index.ts`
- [ ] Consider adding to `send-push` in future

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 architecture review | Monolithic files grow quickly |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- Supabase shared functions: https://supabase.com/docs/guides/functions/quickstart#shared-modules
