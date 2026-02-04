---
status: pending
priority: p2
issue_id: "219"
tags: [architecture, code-review, duplication, pr-13]
dependencies: []
---

# Duplicate Code Paths for Accept/Decline Suggestion

## Problem Statement

There are TWO different code paths for accepting/declining courier suggestions, with different implementations:

1. **`src/routes/client/+page.server.ts`** - Uses direct Supabase queries (acceptSuggestion, declineSuggestion)
2. **`src/routes/client/services/[id]/+page.server.ts`** - Uses RPC functions (acceptReschedule, declineReschedule)

The direct query path does NOT write to `service_reschedule_history`, while the RPC path does. This creates inconsistent audit trails depending on which UI the client uses.

**Impact:** Inconsistent behavior between list view and detail view; missing audit trail for some schedule changes.

## Findings

**Path 1: Direct Queries (client/+page.server.ts)**
```typescript
// acceptSuggestion action - NO history tracking
const { error: updateError } = await supabase
  .from('services')
  .update({
    scheduled_date: service.suggested_date,
    scheduled_time_slot: service.suggested_time_slot,
    // ...
  })
  .eq('id', serviceId);
```

**Path 2: RPC Functions (client/services/[id]/+page.server.ts)**
```typescript
// acceptReschedule action - WITH history tracking
const { data, error: rpcError } = await supabase.rpc('client_approve_reschedule', {
  p_service_id: params.id
});
```

**RPC Functions ARE Used:**
- `client_approve_reschedule` at `src/routes/client/services/[id]/+page.server.ts:241`
- `client_deny_reschedule` at `src/routes/client/services/[id]/+page.server.ts:284`
- `reschedule_service` at `src/routes/courier/services/[id]/+page.server.ts:298`

## Proposed Solutions

### Option A: Consolidate to RPC Calls (Recommended)

Update `src/routes/client/+page.server.ts` to use the RPC functions:

```typescript
// acceptSuggestion action
const { data, error } = await supabase.rpc('client_approve_reschedule', {
  p_service_id: serviceId
});
```

**Pros:** Single source of truth, consistent history tracking
**Cons:** Minor refactoring needed
**Effort:** Small
**Risk:** Low

### Option B: Add History Tracking to Direct Queries

Keep both paths but add `service_reschedule_history` inserts to the direct query path:

```typescript
// After successful update, insert history
await supabase.from('service_reschedule_history').insert({...});
```

**Pros:** Both paths work identically
**Cons:** Duplicates RPC logic in TypeScript
**Effort:** Medium
**Risk:** Low

### Option C: Remove RPC Functions

Delete the RPC migration and update detail page to use direct queries.

**Pros:** Single code path
**Cons:** Loses history tracking entirely
**Effort:** Medium
**Risk:** Medium (may lose audit requirements)

## Technical Details

**Affected Files:**
- `src/routes/client/+page.server.ts` (acceptSuggestion, declineSuggestion, batch variants)
- `src/routes/client/services/[id]/+page.server.ts` (acceptReschedule, declineReschedule)
- `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`

**Key Difference:**
- RPCs insert into `service_reschedule_history` table
- Direct queries do NOT insert into history table

## Acceptance Criteria

- [ ] Single code path for accept/decline suggestion
- [ ] All schedule changes recorded in `service_reschedule_history`
- [ ] Consistent behavior between list view and detail view
- [ ] Tests verify history is recorded

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #13 code review | Architecture strategist flagged |
| 2026-02-04 | Corrected finding: RPCs ARE used, issue is duplication | Verification found RPCs called from service detail pages |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
