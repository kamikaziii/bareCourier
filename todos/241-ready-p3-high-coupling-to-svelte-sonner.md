---
status: ready
priority: p3
issue_id: "241"
tags: [code-review, architecture, pr-16]
dependencies: []
---

# High Coupling to svelte-sonner Library

## Problem Statement

All 20+ modified routes directly import `{ toast }` from `$lib/utils/toast.js`, creating tight coupling to the svelte-sonner library. Future library swaps would require updating many files.

**Why it matters:** Library lock-in reduces flexibility for future changes.

## Findings

**Source:** Architecture Strategist Agent

**Pattern:**
```typescript
import { toast } from "$lib/utils/toast.js";
```

**Found in:** 20+ route files

**Risk:** If we later need to:
- Switch to a different toast library
- Add analytics on toast events
- Implement toast deduplication
- Add rate limiting

...we'd need to update 20+ files.

## Proposed Solutions

### Option A: Accept Current Coupling (Recommended for Now)
The coupling is acceptable for a small app. Re-exporting from `$lib/utils/toast.js` already provides one level of indirection.

**Pros:** No additional abstraction
**Cons:** Library swap requires find-replace
**Effort:** None
**Risk:** Low (svelte-sonner is stable)

### Option B: Create FeedbackService Abstraction
```typescript
// src/lib/services/feedback.ts
export interface FeedbackService {
  success(message: string): void;
  error(message: string): void;
  warning(message: string): void;
}
```

**Pros:** Complete decoupling
**Cons:** Over-engineering for current needs
**Effort:** Large
**Risk:** Low

## Recommended Action

<!-- Fill after triage - likely "Accept Current Coupling" -->

## Technical Details

**If implementing abstraction:**
- Create `src/lib/services/feedback.ts`
- Update all imports in 20+ files
- Configure provider in root layout

## Acceptance Criteria

- [ ] Decision documented
- [ ] If abstracting, all routes use FeedbackService

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #16 code review | Architecture agent flagged coupling, but current level is acceptable |

## Resources

- PR #16: feat: implement toast notification system
