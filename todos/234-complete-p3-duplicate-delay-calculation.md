---
status: complete
priority: p3
issue_id: "234"
tags: [code-review, pr-14, code-quality, duplication]
dependencies: []
---

# Duplicate Delay Calculation in fetchWithRetry

## Problem Statement

The delay calculation for exponential backoff appears twice in `fetchWithRetry()`, with slightly different implementations. This creates maintenance burden and potential for inconsistency.

**Why it matters:**
- Magic numbers (500, 300) appear without named constants
- Two code paths for the same concept
- Easy to update one but forget the other

## Findings

**Location 1:** Response error retry (lines 139-143)
```typescript
const retryAfterHeader = response.headers.get("retry-after");
const parsedRetryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
const baseDelay = !isNaN(parsedRetryAfter)
  ? parsedRetryAfter * 1000
  : Math.pow(2, attempt) * 500;

const jitter = Math.random() * 300;
const delay = baseDelay + jitter;
```

**Location 2:** Network error retry (line 167)
```typescript
const delay = Math.pow(2, attempt) * 500 + Math.random() * 300;
```

**Difference:** Location 1 respects Retry-After header, Location 2 does not (which is correct since there's no response).

## Proposed Solutions

### Option A: Extract named constants (Recommended)
**Pros:** Documents intent, easy to change
**Cons:** Minimal
**Effort:** Small
**Risk:** Very Low

```typescript
const RETRY_CONFIG = {
  BASE_DELAY_MS: 500,
  MAX_JITTER_MS: 300,
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_TIMEOUT_MS: 30000,
} as const;

// Usage
const baseDelay = Math.pow(2, attempt) * RETRY_CONFIG.BASE_DELAY_MS;
const jitter = Math.random() * RETRY_CONFIG.MAX_JITTER_MS;
```

### Option B: Extract helper function
**Pros:** Single source of truth
**Cons:** May be overkill for 2 uses
**Effort:** Small
**Risk:** Very Low

```typescript
function calculateRetryDelay(
  attempt: number,
  retryAfterSeconds?: number
): number {
  const baseDelay = retryAfterSeconds !== undefined
    ? retryAfterSeconds * 1000
    : Math.pow(2, attempt) * RETRY_CONFIG.BASE_DELAY_MS;

  return baseDelay + Math.random() * RETRY_CONFIG.MAX_JITTER_MS;
}

// Usage
const delay = calculateRetryDelay(attempt, parsedRetryAfter);
const delay = calculateRetryDelay(attempt);  // Network error case
```

## Recommended Action

Implement Option A (named constants). This is the simplest improvement with immediate documentation value.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Constants to extract:**
  - BASE_DELAY_MS = 500
  - MAX_JITTER_MS = 300
  - DEFAULT_MAX_RETRIES = 3
  - DEFAULT_TIMEOUT_MS = 30000

## Acceptance Criteria

- [ ] Create RETRY_CONFIG constant object
- [ ] Replace magic numbers with constant references
- [ ] Add JSDoc comment explaining the values
- [ ] Verify retry behavior unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-02-04 | Created from PR #14 pattern review | Magic numbers should be named constants |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
