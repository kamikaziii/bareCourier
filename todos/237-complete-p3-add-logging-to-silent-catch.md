---
status: complete
priority: p3
issue_id: "237"
tags: [code-review, pr-14, observability, error-handling]
dependencies: []
---

# Add Logging to Silent Catch in isRetryableRateLimit

## Problem Statement

The `isRetryableRateLimit()` function has a silent catch block that returns a default value without logging. This makes it hard to debug why rate limit detection might be failing.

**Why it matters:**
- No visibility into JSON parsing failures
- Hard to detect if Resend changes response format
- Silent failures can mask upstream issues
- Inconsistent with edge function error handling patterns

## Findings

**Location:** `supabase/functions/send-email/index.ts`, lines 82-84

**Current code:**
```typescript
catch {
  // If we can't parse body, assume retryable (safer for transient issues)
  return { retryable: true, errorName: "parse_error" };
}
```

**Edge function convention (from send-push/index.ts):**
```typescript
} catch (error) {
  return { success: false, id: sub.id, statusCode, error: (error as Error).message };
}
```

## Proposed Solutions

### Option A: Add console.warn (Recommended)
**Pros:** Visibility without changing behavior
**Cons:** Minimal
**Effort:** Small
**Risk:** Very Low

```typescript
catch (error) {
  console.warn(
    '[send-email] Failed to parse rate limit response:',
    error instanceof Error ? error.message : String(error)
  );
  // Assume retryable on parse error (safer for transient issues)
  return { retryable: true, errorName: "parse_error" };
}
```

### Option B: Keep silent but document
**Pros:** No log noise
**Cons:** Less visibility
**Effort:** Small
**Risk:** N/A

```typescript
catch {
  // Silent catch is intentional: parse errors are rare and we default to retrying
  // which is the safer behavior for transient network issues
  return { retryable: true, errorName: "parse_error" };
}
```

## Recommended Action

Implement Option A. The logging overhead is minimal and provides valuable debugging information when things go wrong.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Function:** `isRetryableRateLimit()`
- **Log level:** warn (not error, since we're handling it)

## Acceptance Criteria

- [ ] Add console.warn to catch block
- [ ] Include error message in log
- [ ] Verify default behavior (retryable: true) is preserved

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 pattern review | Silent catches should at least log |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
