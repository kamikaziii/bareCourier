---
status: pending
priority: p2
issue_id: "246"
tags: [code-review, security, cors, pr-13]
dependencies: []
---

# CORS Returns localhost for Non-Matching Origins

## Problem Statement

When the `Origin` header doesn't match the allowed origins list, the code defaults to returning `allowedOrigins[0]` (localhost:5173) instead of rejecting or omitting the header. This is not security best practice.

## Findings

**Source:** security-sentinel agent

**Location:** `supabase/functions/send-email/index.ts` lines 18-31

**Current code:**
```typescript
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://barecourier.vercel.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  //                                                                 ^^^^^^^^^^^^^^^^
  // Returns localhost even for unknown origins
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    ...
  };
}
```

**Impact:**
- Information leak (reveals localhost is a valid origin)
- Masks debugging issues
- Not security best practice (though auth will still fail)

## Proposed Solutions

### Solution 1: Return Empty String for Non-Matching (Recommended)
**Pros:** Cleaner, more secure
**Cons:** None
**Effort:** Small
**Risk:** Low

```typescript
const allowedOrigin = allowedOrigins.includes(origin) ? origin : "";
```

### Solution 2: Return Production URL for Non-Matching
**Pros:** Reveals less about dev setup
**Cons:** Still not ideal
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `supabase/functions/send-email/index.ts`
- `supabase/functions/send-notification/index.ts`
- `supabase/functions/send-push/index.ts`
- Other edge functions with same pattern

## Acceptance Criteria

- [ ] Non-matching origins get empty or no CORS header
- [ ] Legitimate origins still work correctly
- [ ] No information leakage about valid origins

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | CORS misconfiguration |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- MDN CORS: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
