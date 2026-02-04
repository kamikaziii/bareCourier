---
status: ready
priority: p3
issue_id: "239"
tags: [code-review, simplicity, pr-16]
dependencies: ["233"]
---

# withToast() Helper is Dead Code

## Problem Statement

The `withToast()` helper function is defined (33 lines) but never used anywhere in the codebase. All routes use direct `toast.success()` / `toast.error()` calls instead.

**Why it matters:** Dead code adds cognitive load and maintenance burden.

## Findings

**Source:** Code Simplicity + Pattern Recognition Agents

**Location:** `src/lib/utils/toast.ts:20-53`

**Evidence:** Grep for `withToast` finds only the definition, no usages.

**Note:** If keeping withToast(), it has security issues - see #233.

## Proposed Solutions

### Option A: Delete withToast() (Recommended)
Remove the unused function entirely.

```typescript
// toast.ts - simplified
export { toast } from 'svelte-sonner';
```

**Pros:** Removes dead code, eliminates security risk
**Cons:** Can't use it later (but easy to re-add)
**Effort:** Small
**Risk:** None

### Option B: Use It or Lose It
Adopt withToast() in appropriate places, fixing security issues first.

**Pros:** Consistent abstraction
**Cons:** Requires fixing #233 first, then refactoring routes
**Effort:** Large
**Risk:** Low

## Recommended Action

<!-- Fill after triage -->

## Technical Details

**Affected files:**
- `src/lib/utils/toast.ts` - Remove lines 20-53

**Estimated LOC reduction:** 34 lines

## Acceptance Criteria

- [ ] withToast() either used somewhere OR deleted
- [ ] No unused exports in toast.ts

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #16 code review | Both simplicity and pattern agents flagged this |

## Resources

- PR #16: feat: implement toast notification system
- Related: #233 (security issues in withToast)
