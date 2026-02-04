---
status: pending
priority: p2
issue_id: "231"
tags: [code-review, pr-14, typescript, type-safety]
dependencies: []
---

# Error Type Assertion Without Narrowing in Catch Block

## Problem Statement

The catch block in `fetchWithRetry()` uses direct type assertion `(error as Error).name` without validation. If `error` is not an Error (e.g., a string thrown), this will produce `undefined` and potentially cause unexpected behavior.

**Why it matters:**
- JavaScript allows throwing any value, not just Error objects
- Direct assertion bypasses runtime safety
- Could lead to confusing log output ("undefined" as error name)

## Findings

**Location:** `supabase/functions/send-email/index.ts`, lines 159, 161

**Current code:**
```typescript
catch (error) {
  clearTimeout(timeoutId);

  const errorName = (error as Error).name;  // Unsafe assertion
  if (errorName === "AbortError") {
    console.log(`[send-email] Request timeout (attempt ${attempt + 1}/${maxRetries + 1})`);
  }
  // ...
}
```

**Risk scenario:**
```typescript
throw "Network failed";  // errorName would be undefined
throw { code: 500 };     // errorName would be undefined
```

## Proposed Solutions

### Option A: Use instanceof check (Recommended)
**Pros:** Safe, idiomatic TypeScript
**Cons:** Slightly more code
**Effort:** Small
**Risk:** Very Low

```typescript
catch (error) {
  clearTimeout(timeoutId);

  const errorName = error instanceof Error ? error.name : String(error);
  if (errorName === "AbortError") {
    console.log(`[send-email] Request timeout (attempt ${attempt + 1}/${maxRetries + 1})`);
  }
  // ...
}
```

### Option B: Use type guard function
**Pros:** Reusable across codebase
**Cons:** Extra function
**Effort:** Medium
**Risk:** Very Low

```typescript
function getErrorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (typeof error === 'string') return error;
  return 'UnknownError';
}

// Usage
const errorName = getErrorName(error);
```

## Recommended Action

Implement Option A. It's a one-line fix that makes the code defensive against non-Error throws.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Catch block locations:** Lines 158-173
- **AbortError check:** Used to detect timeout vs network errors

## Acceptance Criteria

- [ ] Replace `(error as Error).name` with instanceof check
- [ ] Ensure both catch block usages are updated
- [ ] Test with simulated network errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 TypeScript review | Error narrowing is important for safety |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
- TypeScript unknown type: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
