---
status: ready
priority: p1
issue_id: "275"
tags: [security, database, rls, push-notifications]
dependencies: []
---

# push_subscriptions Table Has No Migration and Potentially No RLS

## Problem Statement
The `push_subscriptions` table exists in production (48 rows, 64KB per `supabase inspect db table-sizes`) but has no `CREATE TABLE` migration. No RLS policies are defined in any migration file. Table stores sensitive push credentials (`auth`, `p256dh`, `endpoint`).

## Findings
- No migration creates the table (grep confirmed)
- Table exists in `database.generated.ts:455-489`
- Queried by `send-push/index.ts:148,209`
- Contains sensitive WebPush subscription keys per user
- Likely created manually outside migration system

## Proposed Solutions

### Option 1: Create migration with RLS policies
- Add migration that: enables RLS (if not already), creates SELECT/INSERT/UPDATE/DELETE policies scoped to `user_id = auth.uid()`
- Use `IF NOT EXISTS` / `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (idempotent)
- **Pros**: Proper security, tracked in migration system
- **Cons**: Need to verify current RLS state in production first
- **Effort**: Small (1 hour)
- **Risk**: Medium (must verify production state before applying)

## Recommended Action
Create a migration that ensures RLS is enabled and adds proper user-scoped policies.

## Technical Details
- **Affected Files**: New migration file
- **Related Components**: Push notification system, `send-push` edge function
- **Database Changes**: Yes — RLS policies on `push_subscriptions`

## Acceptance Criteria
- [ ] Migration adds RLS policies for push_subscriptions
- [ ] Users can only read/write their own subscriptions
- [ ] Push notification flow still works end-to-end

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06
