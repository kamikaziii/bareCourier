# Implement Server-Side Aggregation for Analytics Page

---
status: ready
priority: p2
issue_id: "005"
tags: [code-review, performance, database]
dependencies: []
---

## Problem Statement

The analytics page fetches all services within a date range and aggregates client-side. This scales poorly:

- 1,000 services: ~100KB transfer, ~50ms processing
- 10,000 services: ~1MB transfer, ~500ms processing
- 100,000 services: ~10MB transfer, ~5s processing

**Why it matters**: As the courier's business grows, the analytics page will become unusably slow.

## Findings

- **Location**: `src/routes/courier/analytics/+page.svelte`
- **Agent**: performance-oracle

**Current Implementation**:
```typescript
const { data: services } = await data.supabase
    .from('services')
    .select('id, client_id, status, distance_km, calculated_price, created_at')
    .is('deleted_at', null)
    .gte('created_at', new Date(startDate).toISOString())
    .lt('created_at', endDatePlusOne.toISOString());
```

## Proposed Solutions

### Option 1: PostgreSQL Function for Aggregation (Recommended)
Create a database function that returns pre-aggregated data:

```sql
CREATE OR REPLACE FUNCTION get_analytics_summary(
    p_start_date date,
    p_end_date date
) RETURNS TABLE (
    month date,
    total_services bigint,
    total_km numeric,
    total_revenue numeric,
    pending_count bigint,
    delivered_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        date_trunc('month', created_at)::date as month,
        COUNT(*) as total_services,
        COALESCE(SUM(distance_km), 0) as total_km,
        COALESCE(SUM(calculated_price), 0) as total_revenue,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count
    FROM services
    WHERE deleted_at IS NULL
      AND created_at >= p_start_date
      AND created_at < p_end_date + interval '1 day'
    GROUP BY date_trunc('month', created_at)
    ORDER BY month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

**Pros**: 90%+ reduction in data transfer, O(1) client processing
**Cons**: Requires migration, more complex
**Effort**: Medium
**Risk**: Low

### Option 2: Use Supabase Views
Create a materialized view or regular view for aggregates.

**Pros**: Simpler than function
**Cons**: Less flexible, may require refresh
**Effort**: Medium
**Risk**: Low

## Acceptance Criteria

- [ ] Analytics page loads in <1 second with 10,000 services
- [ ] Charts display correct aggregated data
- [ ] Date range filtering still works

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by performance-oracle agent | Client-side aggregation doesn't scale |
| 2026-01-22 | Approved during triage | Ready for implementation - create DB function |

## Resources

- PostgreSQL aggregate functions: https://www.postgresql.org/docs/current/functions-aggregate.html
