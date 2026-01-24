# Missing Conflict Resolution for Offline Sync

---
status: complete
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

- [x] Conflicts are detected when server has newer version
- [x] User is notified of conflicts (not silent)
- [x] Data is not silently overwritten

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by data-integrity-guardian agent | Offline sync needs conflict resolution |
| 2026-01-24 | Approved during triage | Status changed to ready |
| 2026-01-24 | Implemented conflict detection and resolution | Added SyncConflict type, detectConflict(), resolveConflict(), syncMutationWithConflictCheck(), syncAllPendingMutations() functions. Custom events dispatch to notify UI of conflicts. |

## Implementation Summary

Added comprehensive conflict detection and resolution system to `offline-store.ts`:

### New Types
- `SyncConflict` - Represents a detected conflict with local and server data
- `ConflictResolutionStrategy` - Resolution options (keep_local, keep_server, prompt_user)

### New Functions
- `detectConflict()` - Compares `updated_at` timestamps to detect conflicts
- `getUnresolvedConflicts()` - Retrieves all unresolved conflicts
- `getConflictCount()` / `hasConflicts()` - Check for unresolved conflicts
- `resolveConflict()` - Resolve conflict with keep_local, keep_server, or merged strategy
- `syncMutationWithConflictCheck()` - Sync single mutation with conflict detection
- `syncAllPendingMutations()` - Process all pending mutations with conflict detection

### Events
- `sync-conflict` - Dispatched when a conflict is detected
- `sync-conflict-resolved` - Dispatched when a conflict is resolved
- `sync-complete` - Dispatched with summary after full sync

### Storage
- Added new IndexedDB store `barecourier-conflicts` for persistent conflict tracking
