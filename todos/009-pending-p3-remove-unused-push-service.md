# Remove Unused Push Service

---
status: pending
priority: p3
issue_id: "009"
tags: [code-review, simplicity, dead-code]
dependencies: []
---

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
| 2026-01-22 | Triage decision: Keep pending | Defer deletion - need to investigate how push notifications are actually implemented in the app |
