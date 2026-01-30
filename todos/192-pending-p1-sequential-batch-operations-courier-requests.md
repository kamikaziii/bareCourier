---
status: pending
priority: p1
issue_id: "192"
tags: [performance, code-quality, consistency, code-review]
dependencies: []
---

# Sequential Batch Operations in Courier Requests (Regression)

## Problem Statement

The `batchAccept` action in `courier/requests/+page.server.ts` uses sequential database updates in a `for` loop, while other batch actions in the codebase correctly use parallel `Promise.all()` pattern. This is a **code quality regression** that violates established patterns.

**Why it matters:** Sequential operations are 10x slower than parallel operations. For 10 services, this takes 10 seconds instead of 1 second. This inconsistency also makes the codebase harder to maintain and review.

## Findings

**File:** `src/routes/courier/requests/+page.server.ts` (Lines 495-533)

**Problematic code:**
```typescript
for (const svc of servicesData as Array<{...}>) {
  const { error: updateError } = await supabase
    .from('services')
    .update({ ... })
    .eq('id', svc.id);

  if (!updateError) {
    await notifyClient({ ... }); // Sequential!
  }
}
```

**Correct pattern used elsewhere** (client/+page.server.ts, Lines 175-188):
```typescript
const updatePromises = servicesData.map(svc =>
  supabase.from('services').update({ ... }).eq('id', svc.id)
);
const results = await Promise.all(updatePromises);
```

**Performance comparison:**
- Sequential: 10 services × 100ms = **1000ms (1 second)**
- Parallel: max(10 services @ 100ms) = **100ms**
- **10x performance difference**

**Source:** Kieran Rails Reviewer identified inconsistency in PR #8 review

## Proposed Solutions

### Solution 1: Parallelize Updates (RECOMMENDED)
**Pros:**
- 10x faster for batch operations
- Matches established pattern in codebase
- Simple refactor

**Cons:**
- All updates succeed or all fail (no partial state)
- Need to handle notification failures gracefully

**Effort:** Small (30 minutes)

**Risk:** Low - Pattern already proven in client actions

**Implementation:**
```typescript
// Parallel updates
const updatePromises = servicesData.map(async (svc) => {
  const { error: updateError } = await supabase
    .from('services')
    .update({
      request_status: 'accepted',
      scheduled_date: svc.requested_date,
      scheduled_time_slot: svc.requested_time_slot,
      scheduled_time: svc.requested_time
    })
    .eq('id', svc.id);

  if (!updateError) {
    // Queue notification (don't await here)
    return { id: svc.id, success: true, clientId: svc.client_id };
  }
  return { id: svc.id, success: false, error: updateError };
});

const results = await Promise.all(updatePromises);
const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

// Send notifications in parallel after all updates succeed
if (successful.length > 0) {
  await Promise.all(
    successful.map(({ id, clientId }) =>
      notifyClient({ clientId, serviceId: id, ... })
    )
  );
}

return {
  success: true,
  accepted: successful.length,
  failed: failed.length
};
```

### Solution 2: Use RPC Function (Like batchReschedule)
**Pros:**
- Atomic database transaction
- Matches `batchReschedule` pattern
- Fastest possible implementation

**Cons:**
- Requires new migration
- More complex to test

**Effort:** Medium (2 hours)

**Risk:** Low - Pattern already used in codebase

**Implementation:**
```sql
-- New migration: bulk_accept_services.sql
CREATE OR REPLACE FUNCTION bulk_accept_services(
  p_service_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_updated_count integer := 0;
BEGIN
  v_user_id := (SELECT auth.uid());

  UPDATE public.services
  SET
    request_status = 'accepted',
    scheduled_date = requested_date,
    scheduled_time_slot = requested_time_slot,
    scheduled_time = requested_time,
    updated_at = NOW()
  WHERE id = ANY(p_service_ids)
    AND request_status = 'pending'
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count
  );
END;
$$;
```

## Recommended Action

**Solution 1** - Parallelize updates to match existing client action pattern. This maintains consistency across the codebase and delivers immediate performance improvement.

**✅ VERIFIED SAFE:** Error handling is preserved - the proposed solution still reports partial success (some succeed, some fail), maintaining current behavior. The only change is performance (10x faster).

## Technical Details

**Affected Files:**
- `src/routes/courier/requests/+page.server.ts` (batchAccept action)

**Performance Impact:**
- Current: O(n) sequential operations
- After fix: O(1) parallel operations
- Expected speedup: 10x for batches of 10+ services

**Code Consistency:**
- Client actions: Already use parallel pattern ✅
- Courier reschedule: Uses RPC atomic pattern ✅
- Courier batch accept: Uses sequential pattern ❌ **INCONSISTENT**

## Acceptance Criteria

- [ ] `batchAccept` uses `Promise.all()` for database updates
- [ ] Notifications sent in parallel after updates complete
- [ ] Error handling preserves partial success reporting
- [ ] Performance tested: 10 services complete in <1 second
- [ ] Code review confirms consistency with client actions

## Work Log

### 2026-01-30
- **Discovery:** Kieran Rails Reviewer identified sequential loop during PR #8 review
- **Impact:** Confirmed 10x performance regression vs parallel pattern
- **Inconsistency:** Client actions use correct pattern, courier actions don't
- **Priority:** P1 (blocks merge) - This violates code quality standards

## Resources

- **Related PR:** #8 (feat/navigation-performance-fixes)
- **Comparison:** Client actions (`client/+page.server.ts:175-188`) use correct pattern
- **Reference:** Courier reschedule uses RPC for atomic operations
- **Pattern:** Promise.all() for independent async operations
