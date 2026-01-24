# Add Pagination to Reports Page

---
status: complete
priority: p2
issue_id: "006"
tags: [code-review, performance, ux]
dependencies: []
resolution: "SUPERSEDED - Reports page merged into Insights (P2.2). See #037 (insights-pagination) for the current issue."
---

## Problem Statement

The reports page fetches ALL services within the date range without pagination. This causes the page to become unresponsive with large datasets.

**Why it matters**: User experience degrades significantly with historical data.

## Findings

- **Location**: `src/routes/courier/reports/+page.svelte`
- **Agent**: performance-oracle

**Current Impact**:
- 100 services: Acceptable
- 1,000 services: Noticeable lag
- 10,000 services: Page becomes unresponsive

## Proposed Solutions

### Option 1: Cursor-Based Pagination (Recommended)
Use Supabase's `.range(start, end)` for pagination:

```typescript
const PAGE_SIZE = 50;
let currentPage = $state(0);

const { data: services } = await supabase
    .from('services')
    .select('*, profiles!client_id(id, name)', { count: 'exact' })
    .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)
    .order('created_at', { ascending: false });
```

**Pros**: Simple, works with existing queries
**Cons**: Offset-based can be slow at high offsets
**Effort**: Low-Medium
**Risk**: Low

### Option 2: Virtual Scrolling
Use a virtualized table component that only renders visible rows.

**Pros**: Handles large datasets without pagination UI
**Cons**: More complex, may need library
**Effort**: Medium
**Risk**: Medium

## Acceptance Criteria

- [ ] Reports page loads quickly regardless of date range
- [ ] User can navigate through pages or scroll through data
- [ ] CSV export still works for filtered data

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by performance-oracle agent | Unbounded queries are dangerous |
| 2026-01-22 | Approved during triage | Ready for implementation - add .range() pagination |
