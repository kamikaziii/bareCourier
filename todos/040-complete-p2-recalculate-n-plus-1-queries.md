# N+1 Query Problem in Recalculate Actions

---
status: complete
priority: p2
issue_id: "040"
tags: [performance, database, pr-4]
dependencies: []
---

**Priority**: P2 (Important)
**File**: `src/routes/courier/billing/[client_id]/+page.server.ts:141-164`
**Source**: PR #4 Code Review

## Issue

Both `recalculateMissing` and `recalculateAll` actions iterate over services and make individual UPDATE queries. For large datasets, this creates N database round-trips.

## Current Code

```typescript
for (const service of services as Service[]) {
  // ... calculate price ...

  await (supabase as any)
    .from('services')
    .update({
      calculated_price: priceResult.price,
      price_breakdown: priceResult.breakdown
    })
    .eq('id', service.id);  // N separate updates!
  recalculated++;
}
```

## Fix

Use Promise.all with concurrency or batch updates:

```typescript
// Option 1: Parallel with Promise.all
const updates = services.map(async (service) => {
  const priceResult = await calculateServicePrice(supabase, {...});
  if (priceResult.success) {
    return supabase
      .from('services')
      .update({
        calculated_price: priceResult.price,
        price_breakdown: priceResult.breakdown
      })
      .eq('id', service.id);
  }
});
await Promise.all(updates);

// Option 2: Use a stored procedure for bulk update
```

## Acceptance Criteria

- [ ] Recalculate operations use parallel or batch updates
- [ ] Performance improved for 50+ services
- [ ] No regression in functionality

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified in PR #4 review | Sequential await in loops is N+1 anti-pattern |
| 2026-01-24 | Approved during triage | Status: ready |
