# Client Cannot Accept/Decline Courier Suggestions - RLS Policy Bug

---
status: ready
priority: p1
issue_id: "027"
tags: [bug, rls, database, client, critical]
dependencies: []
plan_task: "P1.2"
plan_status: "PREREQUISITE - First task to implement"
---

> **UX PLAN INTEGRATION**: This bug fix is task **P1.2** in the [UX Implementation Plan](../docs/plans/2026-01-23-ux-implementation-plan.md). It is a **PREREQUISITE** that must be completed first as it unblocks #015 (cancellation) and P3.1.
>
> **Migration file**: `supabase/migrations/018_add_client_update_policy.sql`

## Problem Statement

When a client tries to accept or decline a courier's suggested schedule, clicking the Accept or Decline button does nothing. The dialog stays open and no change occurs. This is a **confirmed bug** caused by RLS policies.

**Why it matters**: This breaks a core workflow - the courier suggests an alternative date, but the client cannot respond. The feature is completely non-functional.

## Root Cause Analysis

### The Bug
The `services_update` RLS policy only allows **courier** role to update services:

```sql
-- Current policy (BROKEN for client suggestion response)
services_update: UPDATE
  qual: is_courier() AND (deleted_at IS NULL)
```

When client calls the server action to accept/decline:
```typescript
// src/routes/client/+page.server.ts
await (supabase as any)
  .from('services')
  .update({
    request_status: 'accepted',
    scheduled_date: service.suggested_date,
    // ...
  })
  .eq('id', serviceId);
```

The RLS policy blocks the update silently (Supabase returns success but affects 0 rows).

### Why No Error Shows
- Supabase doesn't throw an error when RLS blocks an UPDATE - it just updates 0 rows
- The code checks `if (updateError)` but there's no error, just no rows affected
- The success check `result.data?.success` passes because the action returns `{ success: true }`
- But the database wasn't actually updated

## Proposed Solutions

### Option 1: Add Client Update Policy for Own Services (Recommended)
Create a new RLS policy allowing clients to update specific fields on their own services.

**Migration**:
```sql
-- Allow clients to respond to suggestions on their own services
CREATE POLICY services_update_client ON services
  FOR UPDATE
  USING (
    client_id = (SELECT auth.uid())
    AND deleted_at IS NULL
    AND request_status = 'suggested'  -- Only when courier has made a suggestion
  )
  WITH CHECK (
    client_id = (SELECT auth.uid())
    AND deleted_at IS NULL
    -- Restrict what fields can be changed
    AND (
      -- Accept: can set to accepted and copy suggested to scheduled
      (request_status = 'accepted')
      OR
      -- Decline: can set back to pending and clear suggested
      (request_status = 'pending')
    )
  );
```

**Pros**: Granular control, only allows specific state transitions
**Cons**: Complex policy, may need testing
**Effort**: Medium
**Risk**: Low

### Option 2: Simpler Client Update Policy
Allow clients to update their own services with fewer restrictions.

```sql
-- Allow clients to update their own pending services
CREATE POLICY services_update_client ON services
  FOR UPDATE
  USING (
    client_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  )
  WITH CHECK (
    client_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  );
```

**Pros**: Simple, also enables future client features (like cancel)
**Cons**: Less restrictive, client could potentially change other fields
**Effort**: Small
**Risk**: Medium (but server validation exists)

### Option 3: Use Service Account / RPC Function
Create a PostgreSQL function that bypasses RLS for this specific operation.

```sql
CREATE OR REPLACE FUNCTION respond_to_suggestion(
  p_service_id uuid,
  p_accept boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_service RECORD;
BEGIN
  -- Get service and verify ownership
  SELECT * INTO v_service
  FROM public.services
  WHERE id = p_service_id
    AND client_id = auth.uid()
    AND request_status = 'suggested';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found or not in suggested state';
  END IF;

  IF p_accept THEN
    UPDATE public.services SET
      request_status = 'accepted',
      scheduled_date = suggested_date,
      scheduled_time_slot = suggested_time_slot,
      suggested_date = NULL,
      suggested_time_slot = NULL
    WHERE id = p_service_id;
  ELSE
    UPDATE public.services SET
      request_status = 'pending',
      suggested_date = NULL,
      suggested_time_slot = NULL
    WHERE id = p_service_id;
  END IF;
END;
$$;
```

**Pros**: Most secure, explicit control over allowed operations
**Cons**: More code to maintain, requires RPC call from client
**Effort**: Medium
**Risk**: Low

## Recommended Action

**Option 2** for immediate fix (simple policy), then consider **Option 3** for better security long-term.

Option 2 also enables the "client cancel service" feature (todo #015).

## Technical Details

**Affected Files**:
- `supabase/migrations/` - New migration for RLS policy
- No code changes needed if using Option 2 (existing server action will work)

**Testing Required**:
1. As client, create a service request
2. As courier, suggest alternative date
3. As client, accept suggestion → verify service updates
4. As client, decline suggestion → verify service reverts to pending

**Verification Query**:
```sql
-- Check if policy exists after migration
SELECT * FROM pg_policies WHERE tablename = 'services' AND policyname LIKE '%client%';
```

## Acceptance Criteria

- [ ] Client can click Accept and suggestion is accepted
- [ ] Client can click Decline and service returns to pending
- [ ] Dialog closes after successful action
- [ ] Courier receives notification of client's response
- [ ] RLS policy doesn't allow client to modify other fields inappropriately
- [ ] Existing courier update functionality still works

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | User reported buttons not working | Investigated and found RLS policy blocks client updates |
| 2026-01-22 | Root cause confirmed | services_update policy only allows is_courier() |
| 2026-01-22 | Approved during triage | Status changed to ready - CRITICAL BUG - prioritize this one |

## Resources

- Current RLS policies: `supabase/migrations/001_initial_schema.sql`
- Server action: `src/routes/client/+page.server.ts` (lines 46-107, 109-164)
- Client UI: `src/routes/client/+page.svelte` (lines 326-391)
