---
status: complete
priority: p3
issue_id: "236"
tags: [code-review, pr-14, defensive-programming]
dependencies: []
---

# Add Parameter Validation to fetchWithRetry

## Problem Statement

The `fetchWithRetry()` function accepts `maxRetries` and `timeoutMs` parameters without validation. Negative or zero values can cause unexpected behavior.

**Why it matters:**
- `maxRetries = -1` results in zero attempts (loop never runs)
- `timeoutMs = 0` or negative would cause immediate abort
- Silent failures are harder to debug

## Findings

**Location:** `supabase/functions/send-email/index.ts`, line 105

**Current function signature:**
```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  timeoutMs = 30000
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // With maxRetries = -1, this loop never runs!
  }
}
```

**Edge cases:**
- `maxRetries = -1` → No attempts made, falls through to unreachable throw
- `maxRetries = 0` → One attempt, no retries (correct behavior)
- `timeoutMs = 0` → Immediate timeout
- `timeoutMs < 0` → Undefined behavior

## Proposed Solutions

### Option A: Add validation at function start (Recommended)
**Pros:** Fails fast with clear error message
**Cons:** Additional code
**Effort:** Small
**Risk:** Very Low

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  timeoutMs = 30000
): Promise<Response> {
  if (maxRetries < 0) {
    throw new Error("fetchWithRetry: maxRetries must be >= 0");
  }
  if (timeoutMs <= 0) {
    throw new Error("fetchWithRetry: timeoutMs must be > 0");
  }
  // ... rest of function
}
```

### Option B: Use Math.max to clamp values
**Pros:** Tolerant of invalid input
**Cons:** Silently corrects mistakes
**Effort:** Small
**Risk:** Low

```typescript
maxRetries = Math.max(0, maxRetries);
timeoutMs = Math.max(1000, timeoutMs);  // Minimum 1 second
```

## Recommended Action

Implement Option A. Failing fast is better than silently correcting invalid configuration.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Function:** `fetchWithRetry()`
- **Valid ranges:**
  - maxRetries: 0 to reasonable max (e.g., 10)
  - timeoutMs: 1000 to 120000 (1s to 2min)

## Acceptance Criteria

- [ ] Add validation for maxRetries >= 0
- [ ] Add validation for timeoutMs > 0
- [ ] Throw descriptive error on invalid input
- [ ] Test with edge case values

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 TypeScript review | Validate at boundaries |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
