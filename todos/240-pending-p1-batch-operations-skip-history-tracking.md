---
status: pending
priority: p1
issue_id: "240"
tags: [code-review, data-integrity, audit-trail, pr-13]
dependencies: []
---

# Batch Operations Skip History Tracking

## Problem Statement

Batch operations (`batchAcceptSuggestions`, `batchDeclineSuggestions`, `batchAccept`) perform direct database updates without creating `service_reschedule_history` records. Single-item operations use RPC functions that do create history. This creates an incomplete audit trail.

## Findings

**Source:** data-integrity-guardian agent, architecture-strategist agent

**Locations:**
- `src/routes/client/+page.server.ts` lines 225-241 (`batchAcceptSuggestions`)
- `src/routes/client/+page.server.ts` lines 356-367 (`batchDeclineSuggestions`)
- `src/routes/courier/requests/+page.server.ts` lines 525-555 (`batchAccept`)

**Pattern A - Single operations (with history):**
```typescript
const { data: rpcResult } = await supabase.rpc('client_approve_reschedule', {
  p_service_id: serviceId
});
// RPC creates history record, increments reschedule_count, etc.
```

**Pattern B - Batch operations (NO history):**
```typescript
const updatePromises = servicesData.map(svc =>
  supabase.from('services').update({
    request_status: 'accepted',
    scheduled_date: svc.suggested_date,
    // ... NO history record created
  }).eq('id', svc.id)
);
```

**Impact:**
- Incomplete audit trail for compliance
- Cannot track reschedule patterns for analytics
- Single vs batch operations have different data outcomes
- `reschedule_count` and `last_rescheduled_at` not updated in batch

## Proposed Solutions

### Solution 1: Call RPC for Each Service in Batch (Recommended)
**Pros:** Consistent behavior, reuses validated logic
**Cons:** Slightly slower (sequential RPCs)
**Effort:** Medium
**Risk:** Low

```typescript
const results = [];
for (const svc of servicesData) {
  const { data } = await supabase.rpc('client_approve_reschedule', {
    p_service_id: svc.id
  });
  results.push(data);
}
```

### Solution 2: Create Batch RPC Function
**Pros:** Single transaction, best performance
**Cons:** More complex, new migration
**Effort:** Large
**Risk:** Medium

```sql
CREATE FUNCTION batch_approve_reschedule(p_service_ids uuid[])
RETURNS jsonb AS $$ ... $$;
```

### Solution 3: Add History Insert to Batch Handler
**Pros:** Quick fix
**Cons:** Duplicates RPC logic, error-prone
**Effort:** Medium
**Risk:** High (logic duplication)

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `src/routes/client/+page.server.ts`
- `src/routes/courier/requests/+page.server.ts`

**Related Tables:**
- `services`
- `service_reschedule_history`

**Fields Not Updated in Batch:**
- `reschedule_count`
- `last_rescheduled_at`
- `last_rescheduled_by`
- History record in `service_reschedule_history`

## Acceptance Criteria

- [ ] Batch operations create history records
- [ ] `reschedule_count` is incremented
- [ ] `last_rescheduled_at` and `last_rescheduled_by` are set
- [ ] Single and batch operations produce identical data outcomes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Batch operations bypass RPC validation |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
