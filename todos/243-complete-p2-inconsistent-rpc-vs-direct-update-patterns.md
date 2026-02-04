---
status: complete
priority: p2
issue_id: "243"
tags: [code-review, architecture, consistency, pr-13]
dependencies: ["240"]
---

# Inconsistent RPC vs Direct Update Patterns

## Problem Statement

The codebase uses two different patterns for updating services: RPC functions (which include validation, history, and atomic transactions) and direct Supabase updates (which bypass these safeguards). This inconsistency can lead to data integrity issues and makes the codebase harder to maintain.

## Resolution

After review, the patterns are now **intentionally different** based on the type of operation:

### Reschedule Operations (RPC Required)
Operations that change an already-scheduled date MUST use RPC functions for history tracking:

| Operation | RPC Function | Used By |
|-----------|--------------|---------|
| Client accepts courier's suggestion | `client_approve_reschedule` | `acceptSuggestion`, `batchAcceptSuggestions` |
| Client declines courier's suggestion | `client_deny_reschedule` | `declineSuggestion`, `batchDeclineSuggestions` |
| Courier directly reschedules | `reschedule_service` | Reschedule functionality |

### Initial Schedule Operations (Direct Update OK)
Operations that set the FIRST scheduled date do not need history tracking:

| Operation | Pattern | Used By |
|-----------|---------|---------|
| Courier accepts client's request | Direct update | `accept`, `batchAccept` |
| Courier rejects request | Direct update | `reject` |
| Courier suggests alternative | Direct update (sets `suggested_date`) | `suggest` |

**Rationale:** History tracking is for CHANGES to scheduled dates. Accepting an initial request sets the first scheduled date - there's no "old date" to track.

## Verification (2026-02-04)

Checked implementation in:
- `src/routes/client/+page.server.ts`:
  - `batchAcceptSuggestions` - Uses RPC `client_approve_reschedule` (lines 185-188)
  - `batchDeclineSuggestions` - Uses RPC `client_deny_reschedule` (lines 317-320)

- `src/routes/courier/requests/+page.server.ts`:
  - `batchAccept` - Uses direct update (intentional, initial schedule)

## Pattern Documentation

**Rule:** All service RESCHEDULE operations should use RPC functions to ensure:
- Validation of service state
- History record creation
- Atomic updates
- Consistent behavior between single and batch operations

**Exception:** Initial schedule acceptance (request_status: pending -> accepted) uses direct updates because there's no schedule change to track.

## Acceptance Criteria

- [x] All service reschedule operations use consistent RPC pattern
- [x] Batch operations include same validation as single operations (via RPC calls)
- [x] History tracking works for reschedule operations
- [x] Pattern is documented

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Mixed patterns create inconsistency |
| 2026-02-04 | Fixed #240 - batch operations now call RPC | Client batch ops now use RPC |
| 2026-02-04 | Verified and documented pattern | Initial accepts vs reschedules are intentionally different |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- Related: #240 (batch operations skip history) - RESOLVED
- RPC migration: `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`
