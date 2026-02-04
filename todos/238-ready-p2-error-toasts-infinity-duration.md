---
status: ready
priority: p2
issue_id: "238"
tags: [code-review, performance, ux, pr-16]
dependencies: []
---

# Error Toasts with Infinity Duration May Accumulate

## Problem Statement

Error toasts are configured with `duration: Infinity`, meaning they persist until manually closed. On long sessions with repeated failures, toasts could accumulate in memory.

**Why it matters:** PWA users may have long sessions (hours/days). Accumulated toasts could impact memory and UX.

## Findings

**Source:** Performance Oracle Agent

**Pattern found:**
```typescript
toast.error(errorMessage, { duration: Infinity });
```

**Risk:**
- Memory grows if users ignore error messages
- DOM accumulation on repeated failures
- Long sessions (>30 min) with multiple errors

**Mitigation already present:** `visibleToasts={3}` caps visible toasts, but dismissed toasts may still be in memory.

## Proposed Solutions

### Option A: Reasonable Timeout (Recommended)
Change error duration to 8-10 seconds instead of Infinity.

```typescript
toast.error(errorMessage, { duration: 8000 });
```

**Pros:** Auto-cleanup, prevents accumulation
**Cons:** Users might miss error if not looking
**Effort:** Small
**Risk:** Low

### Option B: Keep Infinity but Dedupe by ID
Reuse toast IDs to prevent duplicates.

```typescript
toast.error(errorMessage, { id: 'operation-error', duration: Infinity });
```

**Pros:** Only one error toast at a time
**Cons:** May hide multiple different errors
**Effort:** Small
**Risk:** Low

### Option C: Monitor and Decide Later
Add production monitoring for toast accumulation.

**Pros:** Data-driven decision
**Cons:** Defers the fix
**Effort:** Small
**Risk:** Medium

## Recommended Action

<!-- Fill after triage -->

## Technical Details

**Affected files:**
- All files with `duration: Infinity` in toast.error calls
- Approximately 10-15 locations

## Acceptance Criteria

- [ ] Error toasts have reasonable auto-dismiss time OR dedupe by ID
- [ ] Test: Trigger 5 errors in sequence, verify memory/DOM doesn't grow unbounded

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #16 code review | Performance agent flagged accumulation risk |

## Resources

- PR #16: feat: implement toast notification system
