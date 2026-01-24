# Insights Page Needs Pagination

---
status: ready
priority: p2
issue_id: "037"
tags: [performance, pagination, insights]
dependencies: []
---

**Priority**: P2 (Important)
**File**: `src/routes/courier/insights/+page.svelte:59-66`
**Source**: performance-oracle code review

## Issue

No pagination on services query. Fetches all services for 6 months unbounded. At 100 daily services, this loads 18K+ records into memory.

## Related Issue

`$effect()` on date change (line 139-143) triggers full reload without debounce. Rapid date picker changes cause multiple concurrent queries.

## Fix

1. Add server-side pagination:
```typescript
.range(0, 500)
```

2. Or implement server-side aggregation (preferred for analytics):
```sql
-- Create view or function for aggregated stats
SELECT date_trunc('day', created_at), count(*), sum(calculated_price)
FROM services
GROUP BY 1
```

3. Add debounce to date range changes:
```typescript
import { debounce } from '$lib/utils';
const debouncedLoad = debounce(loadData, 300);
```

## Verification

Test with 1000+ services - page should load in under 2 seconds.

## Acceptance Criteria

- [ ] Services query has pagination or aggregation
- [ ] Date range changes are debounced
- [ ] Page loads quickly with large datasets

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by performance-oracle agent | Unbounded queries don't scale |
| 2026-01-24 | Approved during triage | Status changed to ready |
