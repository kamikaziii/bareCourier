# Remove Unused Push Service

---
status: complete
priority: p3
issue_id: "009"
tags: [code-review, simplicity, dead-code]
dependencies: []
plan_task: "P4.1"
plan_status: "COMPLETED"
resolution: "Push service is now actively used by P4.1 notification infrastructure"
---

> **UX PLAN INTEGRATION**: This todo should be **resolved after P4.1** (Push Notification Infrastructure) in the [UX Implementation Plan](../docs/plans/2026-01-23-ux-implementation-plan.md). P4.1 will properly implement push notifications. After P4.1 is complete, either:
> - **Delete this file** if P4.1 replaces it completely
> - **Integrate this file** into the new push infrastructure
>
> Note: The `push_subscriptions` table already exists and will be used by P4.1.

## Problem Statement

The `push.ts` service file (164 lines) is never imported or used anywhere in the codebase.

**Why it matters**: Dead code increases cognitive load and maintenance burden.

## Findings

- **Location**: `src/lib/services/push.ts`
- **Agent**: code-simplicity-reviewer

**Grep Results**: No imports found for any functions from this file.

## Proposed Solutions

### Option 1: Delete the File (Recommended)
Simply remove `src/lib/services/push.ts`.

**Pros**: Immediate cleanup, ~164 LOC removed
**Cons**: May need to re-implement if push notifications are desired later
**Effort**: Trivial
**Risk**: None (functionality unused)

### Option 2: Implement Push Notifications
If the feature is still wanted, integrate the service properly.

**Pros**: Completes intended feature
**Cons**: Requires significant work
**Effort**: High
**Risk**: Medium

## Acceptance Criteria

- [ ] File removed (if Option 1)
- [ ] No broken imports
- [ ] App still builds and runs

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by code-simplicity-reviewer | YAGNI - don't build what you don't use |
| 2026-01-22 | Triage decision: DEFERRED | Need to research how push notifications are implemented before deciding to delete. This file may be related to intended PWA push functionality. |
