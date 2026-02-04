---
status: pending
priority: p3
issue_id: "242"
tags: [code-review, pr-14, code-quality, logging]
dependencies: []
---

# Inconsistent Attempt Display in Logs

## Problem Statement

Log messages use inconsistent formatting for attempt counts - some show `attempt/maxRetries`, others show `attempt/maxRetries+1`. This can confuse developers reading logs.

**Why it matters:**
- Inconsistent logs are harder to parse
- Mental math required to understand retry count
- Could mislead debugging efforts
- Minor but affects code quality

## Findings

**Location:** `supabase/functions/send-email/index.ts:185, 199, 204`

**Current inconsistency:**
```typescript
// Line 185: Uses maxRetries (not +1)
`[send-email] Retry ${attempt + 1}/${maxRetries} after ${response.status}, waiting ${Math.round(delay)}ms`

// Line 199: Uses maxRetries + 1 (total attempts)
`[send-email] Request timeout (attempt ${attempt + 1}/${maxRetries + 1})`

// Line 204: Uses maxRetries (not +1)
`[send-email] Retry ${attempt + 1}/${maxRetries} after ${errorName}, waiting ${Math.round(delay)}ms`
```

**Confusion:**
- With `maxRetries = 3`: Line 185 shows "Retry 1/3" but Line 199 shows "attempt 1/4"
- Both are correct but use different denominators

## Proposed Solutions

### Option A: Standardize on Total Attempts (Recommended)
**Pros:** Consistent, intuitive (shows actual attempt count)
**Cons:** Minor change
**Effort:** Small
**Risk:** Very Low

```typescript
const totalAttempts = maxRetries + 1;

// Line 185
`[send-email] Retry after ${response.status} (attempt ${attempt + 1}/${totalAttempts}), waiting ${Math.round(delay)}ms`

// Line 199
`[send-email] Request timeout (attempt ${attempt + 1}/${totalAttempts})`

// Line 204
`[send-email] Retry after ${errorName} (attempt ${attempt + 1}/${totalAttempts}), waiting ${Math.round(delay)}ms`
```

### Option B: Use "Retry X of Y retries" Format
**Pros:** More explicit
**Cons:** Longer messages
**Effort:** Small
**Risk:** Very Low

```typescript
`[send-email] Attempt ${attempt + 1} of ${maxRetries + 1}: Retry after ${response.status}, waiting ${Math.round(delay)}ms`
```

## Recommended Action

Implement Option A for consistency with minimal verbosity.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Lines:** 185, 199, 204

## Acceptance Criteria

- [ ] Standardize all log messages to use same attempt format
- [ ] Use `totalAttempts = maxRetries + 1` as denominator
- [ ] Verify log output is clear and consistent

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #14 code quality review | Consistency in logs aids debugging |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
