---
status: complete
priority: p1
issue_id: "316"
tags: [security, rls, database, code-review]
dependencies: []
---

# Missing anon REVOKE on new approve/deny reschedule RPC signatures

## Problem Statement

Migration 000011 revokes anon access from RPCs but only covers the OLD function signatures. The new signatures introduced in migration 000007 — `approve_reschedule(uuid)` and `deny_reschedule(uuid, text)` — are NOT revoked from anon. This means anonymous (unauthenticated) users could potentially call these functions.

## Findings

- Migration 000007 drops old signatures and creates new ones: `approve_reschedule(p_service_id uuid)` and `deny_reschedule(p_service_id uuid, p_reason text)`
- Migration 000011 only revokes from OLD signatures (which no longer exist after 000007)
- The REVOKE statements in 000011 target function signatures that were already dropped
- Net effect: new RPC signatures have no anon REVOKE

**Location:** `supabase/migrations/20260213000011_revoke_anon_from_new_rpcs.sql`

## Proposed Solutions

### Option 1: Add REVOKE for correct signatures (Recommended)
Add a new migration or amend 000011 with:
```sql
REVOKE ALL ON FUNCTION public.approve_reschedule(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.deny_reschedule(uuid, text) FROM anon;
```
- **Pros**: Minimal change, directly fixes the gap
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Technical Details
- **Affected Files**: `supabase/migrations/20260213000011_revoke_anon_from_new_rpcs.sql`
- **Related Components**: RPC functions approve_reschedule, deny_reschedule
- **Database Changes**: Yes - add REVOKE statements for correct function signatures

## Acceptance Criteria
- [x] `approve_reschedule(uuid)` is revoked from anon role
- [x] `deny_reschedule(uuid, text)` is revoked from anon role
- [x] Existing authenticated users can still call these functions

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review
**Actions:**
- Identified by security-sentinel agent during PR #21 review
- Cross-confirmed by multiple review agents

### 2026-02-13 - Fixed by folding into migration 000011
**By:** Claude Code
**Actions:**
- Added REVOKE for `approve_reschedule(uuid)` and `deny_reschedule(uuid, text)` directly into migration 000011
- Migration 000011 was unapplied, so fix was folded in-place instead of creating a corrective migration

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
- Migration 000007 (creates new signatures)
- Migration 000011 (revokes from old signatures only)
