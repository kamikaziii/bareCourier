# Recalculate Actions Don't Respect Date Range Filter

---
status: complete
priority: p2
issue_id: "041"
tags: [bug, ux, pr-4]
dependencies: []
---

**Priority**: P2 (Important)
**File**: `src/routes/courier/billing/[client_id]/+page.server.ts:136-149`
**Source**: PR #4 Code Review

## Issue

The `recalculateMissing` and `recalculateAll` actions recalculate ALL services for a client, ignoring the date range filter shown in the UI. Users expect only the visible services to be recalculated.

## Current Code

```typescript
// Gets ALL services for client - ignores date range
const { data: services } = await supabase
  .from('services')
  .select('*')
  .eq('client_id', client_id)
  .is('deleted_at', null)
  .is('calculated_price', null);
```

## Expected Behavior

Should accept and use the date range from the form:

```typescript
const formData = await request.formData();
const startDate = formData.get('start_date') as string;
const endDate = formData.get('end_date') as string;

const { data: services } = await supabase
  .from('services')
  .select('*')
  .eq('client_id', client_id)
  .is('deleted_at', null)
  .gte('created_at', startDate)
  .lte('created_at', endDate)
  .is('calculated_price', null);
```

## Fix

1. Add hidden inputs for date range in the form
2. Read date range in the server action
3. Apply date filter to query

## Acceptance Criteria

- [ ] Recalculate respects visible date range
- [ ] Hidden inputs pass date range to server
- [ ] Only services in date range are recalculated

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified in PR #4 review | UI filters should be respected by bulk actions |
| 2026-01-24 | Approved during triage | Status: ready |
