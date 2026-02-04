---
status: complete
priority: p1
issue_id: "240"
tags: [code-review, data-integrity, audit-trail, pr-13]
dependencies: []
---

# Batch Operations Skip History Tracking

## Problem Statement

Batch operations (`batchAcceptSuggestions`, `batchDeclineSuggestions`, `batchAccept`) perform direct database updates without creating `service_reschedule_history` records. Single-item operations use RPC functions that do create history. This creates an incomplete audit trail.

## Resolution

**Solution Implemented:** Solution 1 - Call RPC for each service in batch (for reschedule operations)

### Client Batch Operations (FIXED - Now Use RPC)

Both `batchAcceptSuggestions` and `batchDeclineSuggestions` now call the RPC functions:

```typescript
// batchAcceptSuggestions - now uses RPC
const rpcPromises = servicesData.map(svc =>
  supabase.rpc('client_approve_reschedule', {
    p_service_id: svc.id
  })
);

// batchDeclineSuggestions - now uses RPC
const rpcPromises = servicesData.map(svc =>
  supabase.rpc('client_deny_reschedule', {
    p_service_id: svc.id
  })
);
```

### Courier batchAccept (Intentionally Direct Update)

The `batchAccept` operation remains a direct update because it sets the FIRST scheduled date (accepting client's initial request), not a reschedule. There is no schedule change to track in history.

See TODO #243 for full documentation of the RPC vs direct update pattern.

## Verification

Checked implementation (2026-02-04):
- `src/routes/client/+page.server.ts`:
  - `batchAcceptSuggestions` calls `client_approve_reschedule` RPC (lines 185-188)
  - `batchDeclineSuggestions` calls `client_deny_reschedule` RPC (lines 317-320)
- RPC functions include history tracking: `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`

## Acceptance Criteria

- [x] Batch reschedule operations create history records (via RPC)
- [x] `reschedule_count` is incremented (via RPC)
- [x] `last_rescheduled_at` and `last_rescheduled_by` are set (via RPC)
- [x] Single and batch reschedule operations produce identical data outcomes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Batch operations bypass RPC validation |
| 2026-02-04 | Implemented Solution 1 | Call RPC for each service in batch |
| 2026-02-04 | Documented pattern in #243 | Initial accepts vs reschedules are intentionally different |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- Related: #243 (RPC vs direct update patterns)
- RPC migration: `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`
