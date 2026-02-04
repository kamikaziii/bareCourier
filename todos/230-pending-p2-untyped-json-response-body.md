---
status: pending
priority: p2
issue_id: "230"
tags: [code-review, pr-14, typescript, type-safety]
dependencies: []
---

# Untyped JSON Response Body in isRetryableRateLimit

## Problem Statement

The `isRetryableRateLimit()` function parses JSON without type annotation, resulting in an implicit `any` type. This violates the project's TypeScript strict mode conventions.

**Why it matters:**
- Implicit `any` bypasses type checking
- No autocomplete or type inference for error properties
- Potential runtime errors if response shape changes

## Findings

**Location:** `supabase/functions/send-email/index.ts`, lines 77-79

**Current code:**
```typescript
const body = await cloned.json();  // body is 'any'
const errorName = body?.name || "unknown";
```

**Expected:** TypeScript strict mode should flag untyped JSON parsing.

## Proposed Solutions

### Option A: Add ResendErrorResponse interface (Recommended)
**Pros:** Full type safety, documents expected shape
**Cons:** Interface may need updates if Resend changes
**Effort:** Small
**Risk:** Very Low

```typescript
interface ResendErrorResponse {
  name?: string;
  message?: string;
  statusCode?: number;
}

async function isRetryableRateLimit(
  response: Response
): Promise<{ retryable: boolean; errorName: string }> {
  try {
    const cloned = response.clone();
    const body = (await cloned.json()) as ResendErrorResponse;
    const errorName = body?.name ?? "unknown";
    return { retryable: errorName === "rate_limit_exceeded", errorName };
  } catch {
    return { retryable: true, errorName: "parse_error" };
  }
}
```

### Option B: Use unknown with type guard
**Pros:** More defensive, doesn't assume shape
**Cons:** More verbose
**Effort:** Medium
**Risk:** Very Low

```typescript
const body = await cloned.json() as unknown;
const errorName = typeof body === 'object' && body !== null && 'name' in body
  ? String((body as { name: unknown }).name)
  : "unknown";
```

## Recommended Action

Implement Option A. The Resend error response shape is well-documented and unlikely to change frequently.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **TypeScript config:** strict mode enabled
- **Resend error format:** `{ name: "error_type", message: "description" }`

## Acceptance Criteria

- [ ] Add `ResendErrorResponse` interface
- [ ] Type the JSON response with `as ResendErrorResponse`
- [ ] Use `??` instead of `||` for nullish coalescing
- [ ] Verify no TypeScript errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 TypeScript review | JSON parsing needs explicit types |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- Resend API errors: https://resend.com/docs/api-reference/errors
