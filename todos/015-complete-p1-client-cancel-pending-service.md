# Client Cannot Cancel Pending Service Requests

---
status: complete
priority: p1
issue_id: "015"
tags: [code-review, ux, feature-parity, client]
dependencies: ["027"]
plan_task: "P3.1"
plan_status: "COMPLETED"
---

## Problem Statement

Clients have no way to cancel a pending service request before it's accepted by the courier. Once a service is created, the client can only view it or respond to suggestions - they cannot cancel it.

**Why it matters**: Users expect to be able to cancel requests they've made, especially if circumstances change before the courier accepts. This is a fundamental user expectation for any request-based system.

## Findings

- **Location**: `src/routes/client/+page.svelte` (client dashboard)
- **Location**: `src/routes/client/services/[id]/+page.svelte` (service detail)
- **Agent**: UX Review

**Current State**:
- Client dashboard shows services as clickable cards linking to detail view
- Service detail page shows status, locations, timestamps, and history
- No cancel button or action exists anywhere in client flow
- Only courier can modify/delete services

**Comparison with Courier**:
- Courier has full CRUD: Create, Read, Update, Delete
- Courier can delete services via dropdown menu on detail page
- Client has only: Create, Read

## Proposed Solutions

### Option 1: Add Cancel for Pending-Only Services (Recommended)
Allow clients to cancel services that are still in `request_status: 'pending'` (not yet accepted).

**Implementation**:
```svelte
<!-- In client service detail page -->
{#if service.request_status === 'pending'}
  <Button variant="destructive" onclick={handleCancel}>
    {m.action_cancel_request()}
  </Button>
{/if}
```

Server action to soft-delete (set `deleted_at`):
```typescript
// +page.server.ts
cancelRequest: async ({ locals, params }) => {
  const { supabase, safeGetSession } = locals;
  const { session } = await safeGetSession();

  // Verify ownership and pending status
  const { data: service } = await supabase
    .from('services')
    .select('client_id, request_status')
    .eq('id', params.id)
    .single();

  if (service?.client_id !== session?.user.id) {
    return fail(403, { error: 'Not authorized' });
  }

  if (service?.request_status !== 'pending') {
    return fail(400, { error: 'Cannot cancel accepted service' });
  }

  await supabase
    .from('services')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id);

  redirect(303, '/client');
}
```

**Pros**: Simple, matches user expectations, preserves data for audit
**Cons**: None significant
**Effort**: Small
**Risk**: Low

### Option 2: Allow Cancel for All Non-Delivered Services
Allow cancellation even after acceptance, but before delivery.

**Pros**: More flexible
**Cons**: May cause operational issues for courier who planned the route
**Effort**: Small
**Risk**: Medium (operational disruption)

## Recommended Action

Option 1 - Cancel only pending (not yet accepted) services. This balances user control with operational stability.

## Technical Details

**Affected Files**:
- `src/routes/client/services/[id]/+page.svelte` - Add cancel button
- `src/routes/client/services/[id]/+page.server.ts` - Add cancel action
- `src/routes/client/+page.svelte` - Optionally add cancel from dashboard

**Database Changes**: None (uses existing `deleted_at` column)

**i18n Keys Needed**:
- `action_cancel_request`
- `confirm_cancel_request`
- `confirm_cancel_request_desc`
- `cancel_success`

## Acceptance Criteria

- [ ] Client can see cancel button on pending service detail page
- [ ] Cancel button NOT shown for accepted/suggested/delivered services
- [ ] Confirmation dialog before cancellation
- [ ] Service is soft-deleted (deleted_at set)
- [ ] Client is redirected to dashboard after cancel
- [ ] Notification sent to courier about cancellation
- [ ] i18n messages added for PT and EN

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | Client has no way to cancel - critical feature gap |
| 2026-01-22 | Approved during triage | Status changed to ready - ready to implement |

## Resources

- Similar pattern: Courier delete in `src/routes/courier/services/[id]/+page.svelte`
- **DEPENDENCY**: Requires #027 RLS fix first - current `services_update` policy only allows courier role
- RLS policy `018_add_client_update_policy.sql` must be applied before implementing this feature
