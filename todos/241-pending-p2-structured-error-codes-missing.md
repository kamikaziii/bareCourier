---
status: pending
priority: p2
issue_id: "241"
tags: [code-review, pr-14, agent-native, api-design, error-handling]
dependencies: ["238", "239"]
---

# Structured Error Codes Missing

## Problem Statement

Error responses from the send-email function lack machine-parseable error codes and retryable flags, making it difficult for automated callers (agents, cron jobs) to handle errors appropriately.

**Why it matters:**
- Agents cannot programmatically determine error type
- No way to know if retrying is appropriate
- String parsing required for error handling
- Poor developer experience for API consumers

## Findings

**Location:** `supabase/functions/send-email/index.ts:470-628`

**Current error responses:**
```json
// Various error types, all use same structure:
{ "error": "RESEND_API_KEY not configured" }
{ "error": "user_id and template are required" }
{ "error": "Resend API error: {...}" }
{ "error": "<raw error message>" }
```

**Missing information:**
- Error code enum (e.g., `RATE_LIMIT`, `QUOTA_EXCEEDED`, `VALIDATION_ERROR`)
- Retryable flag (boolean)
- Retry-after hint (for rate limits)

## Proposed Solutions

### Option A: Add Error Code Enum (Recommended)
**Pros:** Machine-parseable, clear contract
**Cons:** Breaking change for existing callers (minor)
**Effort:** Medium
**Risk:** Low

```typescript
type ErrorCode =
  | "CONFIG_ERROR"
  | "AUTH_ERROR"
  | "VALIDATION_ERROR"
  | "USER_NOT_FOUND"
  | "NOTIFICATIONS_DISABLED"
  | "RATE_LIMIT"
  | "QUOTA_EXCEEDED"
  | "API_ERROR"
  | "INTERNAL_ERROR";

interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    retryAfterMs?: number;
  };
}

// Example usage:
return new Response(
  JSON.stringify({
    success: false,
    error: {
      code: "RATE_LIMIT",
      message: "Rate limit exceeded, please retry later",
      retryable: true,
      retryAfterMs: 60000
    }
  }),
  { status: 429, ... }
);
```

### Option B: Add Retryable Flag Only
**Pros:** Minimal change, backward compatible
**Cons:** Less information
**Effort:** Small
**Risk:** Very Low

```json
{
  "error": "Rate limit exceeded",
  "retryable": true
}
```

## Recommended Action

Implement Option A for comprehensive agent support. This should be done after #238 and #239 (error sanitization).

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Lines:** All error return statements (470, 479, 507, 521, 551, 561, 571, 605, 625)
- **Dependencies:** Should fix #238, #239 first

## Acceptance Criteria

- [ ] Define ErrorCode type
- [ ] Define ErrorResponse interface
- [ ] Update all error returns to use structured format
- [ ] Include retryable flag based on error type
- [ ] Add retryAfterMs for rate limit errors
- [ ] Update API documentation (#244)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #14 agent-native review | APIs need machine-parseable errors |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- Problem Details RFC: https://www.rfc-editor.org/rfc/rfc7807
