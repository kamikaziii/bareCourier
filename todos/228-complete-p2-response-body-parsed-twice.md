---
status: complete
priority: p2
issue_id: "228"
tags: [code-review, pr-14, performance]
dependencies: []
---

# Response Body Parsed Twice on 429 Errors

## Problem Statement

For 429 responses, the response body is parsed twice:
1. Once in `isRetryableRateLimit()` to check the error type
2. Once again in the main error handling if the request ultimately fails

This creates extra memory allocation and CPU overhead from redundant JSON parsing.

**Why it matters:**
- Extra memory allocation for cloned response stream
- Redundant JSON parsing (CPU overhead)
- Deno's Response.clone() creates a full copy of response including headers and body

## Findings

**Location:** `supabase/functions/send-email/index.ts`

**First parse (line 77-78):**
```typescript
// In isRetryableRateLimit():
const cloned = response.clone();
const body = await cloned.json();
```

**Second parse (line 563):**
```typescript
// In main error handling:
const errorData = await resendResponse.json();
```

When a 429 response ultimately fails (all retries exhausted), the body is parsed once to determine if it's retryable, then parsed again to build the error response.

## Proposed Solutions

### Option A: Return parsed body from isRetryableRateLimit (Recommended)
**Pros:** Eliminates redundant parsing, minimal change
**Cons:** Changes return type slightly
**Effort:** Small
**Risk:** Very Low

```typescript
async function isRetryableRateLimit(response: Response): Promise<{
  retryable: boolean;
  errorName: string;
  parsedBody?: Record<string, unknown>;  // Return the parsed body
}> {
  try {
    const body = await response.json();  // No clone needed
    const errorName = body?.name ?? "unknown";
    return {
      retryable: errorName === "rate_limit_exceeded",
      errorName,
      parsedBody: body  // Preserve for later use
    };
  } catch {
    return { retryable: true, errorName: "parse_error" };
  }
}
```

Then modify `fetchWithRetry` to return the parsed body when available, avoiding re-parsing in the main handler.

### Option B: Accept the overhead
**Pros:** No code change
**Cons:** Suboptimal performance
**Effort:** None
**Risk:** N/A

The overhead is minor for a low-volume email function. This is acceptable if the team prioritizes simplicity over optimization.

## Recommended Action

Implement Option A. The change is minimal and improves efficiency, especially during rate limiting when multiple retries occur.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Functions:** `isRetryableRateLimit()`, `fetchWithRetry()`
- **Impact:** Eliminates 1 JSON parse + 1 response clone per 429 response

## Acceptance Criteria

- [ ] Modify `isRetryableRateLimit()` to return `parsedBody`
- [ ] Modify `fetchWithRetry()` to preserve and return parsed body when available
- [ ] Update main handler to use preserved body instead of re-parsing
- [ ] Test 429 handling still works correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 performance review | Response cloning has memory cost |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- Deno Response.clone(): https://deno.land/api?s=Response
