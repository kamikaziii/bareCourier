# Missing Conflict Resolution for Offline Sync

---
status: ready
priority: p1
issue_id: "030"
tags: [data-integrity, offline, sync]
dependencies: []
---

**Priority**: P1 (Critical)
**File**: `src/lib/services/offline-store.ts:184-212`
**Source**: data-integrity-guardian code review

## Issue

`applyOptimisticUpdate` overwrites cached data without version checking. If server state changed while offline, sync will silently lose data. Missing `updated_at` comparison before applying server sync.

## Scenario

1. User A (offline) marks service as delivered
2. User B (online) updates same service notes
3. User A comes online, sync pushes their version
4. User B's notes update is silently overwritten

## Fix

1. Add `updated_at` comparison during sync
2. Implement conflict detection:
   - Compare local `updated_at` with server `updated_at`
   - If server is newer, prompt user or merge changes
3. Consider optimistic locking pattern with version field

## Verification

1. Test: Make offline change, simulate server change, verify conflict detected on sync
2. Ensure no silent data loss when conflicting edits occur

## Acceptance Criteria

- [ ] Conflicts are detected when server has newer version
- [ ] User is notified of conflicts (not silent)
- [ ] Data is not silently overwritten

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by data-integrity-guardian agent | Offline sync needs conflict resolution |
| 2026-01-24 | Approved during triage | Status changed to ready |
