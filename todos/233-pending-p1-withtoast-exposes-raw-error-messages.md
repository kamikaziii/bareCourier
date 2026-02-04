---
status: pending
priority: p1
issue_id: "233"
tags: [code-review, security, pr-16]
dependencies: []
---

# withToast() Exposes Raw Error Messages by Default

## Problem Statement

The `withToast()` helper defaults to displaying `response.error.message` and `error.message` directly when no custom error message is provided. Supabase error messages can include:
- Database constraint violations with column/table names
- Row-level security policy rejection details
- Query structure information

**Why it matters:** Even if withToast() is currently unused, if adopted it would silently leak database schema details.

## Findings

**Source:** Security Sentinel Agent

**Location:** `src/lib/utils/toast.ts:34, 48`

```typescript
: response.error.message;  // Line 34 - displays raw Supabase error
: error.message;           // Line 48 - displays raw JavaScript error
```

**Example leaked info:**
```
"new row violates row level security policy for table "services" and action INSERT"
"duplicate key value violates unique constraint "users_email_key""
```

## Proposed Solutions

### Option A: Safe Fallback Message (Recommended)
Change default to generic safe message instead of raw error.

```typescript
const errorMessage = messages.error
  ? typeof messages.error === 'function'
    ? messages.error(new Error(response.error.message))
    : messages.error
  : 'An error occurred. Please try again.';  // Safe fallback
```

**Pros:** Simple fix, maintains API
**Cons:** Less debugging info (but that's the point)
**Effort:** Small
**Risk:** Low

### Option B: Remove withToast() Entirely
Since it's currently unused (dead code), just delete it.

**Pros:** No security risk, reduces code
**Cons:** May want it for future use
**Effort:** Small
**Risk:** Low

### Option C: Require Error Message
Make `messages.error` a required field.

**Pros:** Forces developers to think about error UX
**Cons:** Breaking change if adopted later
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- Fill after triage -->

## Technical Details

**Affected files:**
- `src/lib/utils/toast.ts`

## Acceptance Criteria

- [ ] withToast() never displays raw error.message to users
- [ ] Either: safe fallback OR function removed entirely
- [ ] Unit test: verify no Supabase/JS errors leak to toast

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #16 code review | Security + simplicity reviewers both flagged this |

## Resources

- PR #16: feat: implement toast notification system
- Related: #232 (unvalidated edge function errors)
