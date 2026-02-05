---
status: complete
priority: p2
issue_id: "263"
tags: [code-review, agent-native, api-design, pr-15]
dependencies: []
---

# Rate Limit Response Missing Retry Timing

## Problem Statement

When the `create-client` edge function rate-limits an invitation email, it returns a simple error message without a `retryAfterMs` field. This makes it impossible for programmatic callers (agents, automation) to implement proper retry logic.

**Why it matters:**
- Agents cannot determine when to retry
- Inconsistent with `send-email` which has excellent structured errors
- Poor developer experience for API consumers

## Findings

**Location:** `supabase/functions/create-client/index.ts` (lines 131-135)

```typescript
if (isRateLimited(email)) {
    return new Response(
        JSON.stringify({ error: "Please wait before sending another invitation to this email" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
}
```

**Contrast with send-email pattern:**

```typescript
return new Response(
    JSON.stringify({
        error: {
            code: "RATE_LIMIT",
            message: "Rate limit exceeded",
            retryable: true,
            retryAfterMs: 3600000
        }
    }),
    { status: 429, ... }
);
```

## Proposed Solutions

### Option A: Add structured error with retryAfterMs (Recommended)
**Pros:** Agent-friendly, consistent with send-email, backward compatible
**Cons:** Slightly larger response
**Effort:** Small
**Risk:** Very Low

```typescript
if (isRateLimited(email)) {
    const lastSent = rateLimitMap.get(email.toLowerCase()) || 0;
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (Date.now() - lastSent);

    return new Response(
        JSON.stringify({
            error: {
                code: "RATE_LIMIT",
                message: "Please wait before sending another invitation to this email",
                retryable: true,
                retryAfterMs: Math.max(0, retryAfterMs)
            }
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
}
```

### Option B: Add Retry-After header only
**Pros:** Standard HTTP approach
**Cons:** Less discoverable than JSON field
**Effort:** Small
**Risk:** Very Low

## Recommended Action

Implement Option A for consistency with `send-email` structured errors.

## Technical Details

- **Affected file:** `supabase/functions/create-client/index.ts`
- **Lines:** 131-135
- **Also update:** The `isRateLimited` function could return remaining time
- **Deployment:** `supabase functions deploy create-client`

## Acceptance Criteria

- [ ] Rate limit response includes `retryAfterMs` field
- [ ] Response uses structured error format: `{ error: { code, message, retryable, retryAfterMs } }`
- [ ] HTTP 429 status code is maintained
- [ ] Consider adding `Retry-After` header as well
- [ ] Update API documentation if exists

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from post-merge audit | Agent-native APIs need retry timing |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
- HTTP 429 Retry-After: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
