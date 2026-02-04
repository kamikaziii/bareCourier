---
status: complete
priority: p3
issue_id: "243"
tags: [code-review, pr-14, code-quality, naming]
dependencies: []
---

# Variable Name Overloading: errorName

## Problem Statement

The variable name `errorName` is used for two different concepts in the retry logic, which could cause confusion when reading the code.

**Why it matters:**
- Same name, different meanings reduces readability
- Could lead to bugs if code is refactored
- Minor but affects code maintainability

## Findings

**Location:** `supabase/functions/send-email/index.ts:96, 197`

**Usage 1 (Line 96):** Resend API error name
```typescript
const errorName = body?.name ?? "unknown";
// Values: "rate_limit_exceeded", "daily_quota_exceeded", etc.
```

**Usage 2 (Line 197):** JavaScript Error.name property
```typescript
const errorName = error instanceof Error ? error.name : String(error);
// Values: "AbortError", "TypeError", etc.
```

**Confusion potential:**
- Both are called `errorName` but represent different error taxonomies
- Resend errors vs JavaScript runtime errors

## Proposed Solutions

### Option A: Rename JS Error Variable (Recommended)
**Pros:** Clear distinction, minimal change
**Cons:** None
**Effort:** Small
**Risk:** Very Low

```typescript
// Line 197
const errorType = error instanceof Error ? error.name : String(error);
if (errorType === "AbortError") {
  console.log(`[send-email] Request timeout (attempt ${attempt + 1}/${maxRetries + 1})`);
}
// ...
console.log(`[send-email] Retry ${attempt + 1}/${maxRetries} after ${errorType}, waiting...`);
```

### Option B: Rename Both for Clarity
**Pros:** Most explicit
**Cons:** More changes
**Effort:** Small
**Risk:** Very Low

```typescript
// Line 96
const resendErrorName = body?.name ?? "unknown";

// Line 197
const jsErrorType = error instanceof Error ? error.name : String(error);
```

## Recommended Action

Implement Option A - rename just the JS error variable to `errorType`.

## Technical Details

- **Affected files:** `supabase/functions/send-email/index.ts`
- **Lines:** 197, 198, 204

## Acceptance Criteria

- [ ] Rename `errorName` on line 197 to `errorType`
- [ ] Update all references in the catch block
- [ ] Verify no functional changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #14 code quality review | Variable names should be unambiguous |

## Resources

- PR #14: https://github.com/kamikaziii/bareCourier/pull/14
