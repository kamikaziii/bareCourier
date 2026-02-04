---
status: complete
priority: p3
issue_id: "235"
tags: [code-review, pr-14, documentation]
dependencies: []
---

# Enhance JSDoc with @param/@returns Annotations

## Problem Statement

The new `fetchWithRetry()` and `isRetryableRateLimit()` functions have descriptive JSDoc comments but lack formal `@param` and `@returns` annotations. This is a minor enhancement for completeness.

**Current state:**
The functions DO have JSDoc descriptions documenting their behavior. They are missing only the formal parameter/return annotations.

**Why it matters (minor):**
- IDE autocomplete and type hints could be enhanced
- Edge cases (maxRetries=0, negative values) could be documented
- Follows full JSDoc conventions

## Findings

**Current function signatures without JSDoc:**
```typescript
async function isRetryableRateLimit(response: Response): Promise<{ retryable: boolean; errorName?: string }> {
  // No documentation
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  timeoutMs = 30000
): Promise<Response> {
  // No documentation
}
```

## Proposed Solutions

### Option A: Add comprehensive JSDoc (Recommended)
**Pros:** Full documentation for future maintainers
**Cons:** More verbose
**Effort:** Small
**Risk:** Very Low

```typescript
/**
 * Checks if a 429 response is due to a retryable rate limit vs. quota exceeded.
 * Resend uses different error names: "rate_limit_exceeded" is temporary, others may be quota.
 *
 * @param response - The HTTP response with status 429
 * @returns Object indicating if retry should be attempted and the error type
 */
async function isRetryableRateLimit(
  response: Response
): Promise<{ retryable: boolean; errorName: string }> {
  // ...
}

/**
 * Fetches a URL with automatic retry on transient failures.
 *
 * Retries on:
 * - Status 429 (rate limit) with "rate_limit_exceeded" error
 * - Status >= 500 (server errors)
 * - Network timeouts (AbortError)
 *
 * Does NOT retry on:
 * - Status 429 with quota errors (non-retryable rate limit)
 * - Status 4xx (except 429) - client errors
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch RequestInit options
 * @param maxRetries - Maximum retry attempts (default: 3). 0 = one attempt, no retries.
 * @param timeoutMs - Request timeout in milliseconds (default: 30000)
 * @returns The Response object (may be error response if all retries exhausted)
 * @throws Error if all retries fail due to network/timeout errors, or invalid parameters
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  timeoutMs = 30000
): Promise<Response> {
  // ...
}
```

## Recommended Action

Implement Option A. The functions have complex behavior that warrants documentation.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Functions:** `isRetryableRateLimit`, `fetchWithRetry`

## Acceptance Criteria

- [ ] Add JSDoc to `isRetryableRateLimit()`
- [ ] Add JSDoc to `fetchWithRetry()`
- [ ] Document retry/no-retry conditions
- [ ] Document parameter edge cases (maxRetries=0)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 TypeScript review | Complex functions need documentation |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- JSDoc reference: https://jsdoc.app/
