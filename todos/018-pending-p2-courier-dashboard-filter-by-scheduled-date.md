# Courier Dashboard Filters by created_at Instead of scheduled_date

---
status: pending
priority: p2
issue_id: "018"
tags: [code-review, ux, courier]
dependencies: []
---

## Problem Statement

The courier dashboard's "Today / Tomorrow / All" filter buttons filter services by `created_at` timestamp, not by `scheduled_date`. For operational use, the courier needs to see what's scheduled for today, not what was created today.

**Why it matters**: A service created yesterday but scheduled for today won't appear in "Today" filter. This defeats the purpose of the filter for daily operations.

## Findings

- **Location**: `src/routes/courier/+page.svelte` (lines 20-31)
- **Agent**: UX Review

**Current Code**:
```typescript
async function loadServices() {
  loading = true;
  let query = data.supabase
    .from('services')
    .select('*, profiles!client_id(name)')
    .order('created_at', { ascending: false });

  if (filter === 'today') {
    query = query.gte('created_at', today.toISOString()).lt('created_at', tomorrow.toISOString());
  } else if (filter === 'tomorrow') {
    query = query.gte('created_at', tomorrow.toISOString()).lt('created_at', dayAfter.toISOString());
  }
  // ...
}
```

**Issue**: Uses `created_at` for filtering and ordering.

## Proposed Solutions

### Option 1: Filter by scheduled_date (Recommended)
Change filter to use `scheduled_date` when available, fall back to `created_at`.

**Implementation**:
```typescript
async function loadServices() {
  loading = true;
  let query = data.supabase
    .from('services')
    .select('*, profiles!client_id(name)')
    .is('deleted_at', null)
    .eq('status', 'pending'); // Only pending for operational view

  if (filter === 'today') {
    // Filter by scheduled_date for scheduled services
    // or created_at for unscheduled (immediate) services
    query = query.or(
      `scheduled_date.gte.${today.toISOString().split('T')[0]},scheduled_date.lt.${tomorrow.toISOString().split('T')[0]},and(scheduled_date.is.null,created_at.gte.${today.toISOString()},created_at.lt.${tomorrow.toISOString()})`
    );
  }
  // ... similar for tomorrow

  // Order by scheduled_date, then created_at
  query = query.order('scheduled_date', { ascending: true, nullsFirst: false })
               .order('created_at', { ascending: false });
}
```

**Pros**: Operationally correct, shows what's actually scheduled
**Cons**: More complex query, needs OR logic for unscheduled services
**Effort**: Medium
**Risk**: Low

### Option 2: Add Separate "Scheduled" View
Keep current behavior but add a new "Scheduled" tab/filter that uses `scheduled_date`.

**Pros**: Preserves current behavior, adds new capability
**Cons**: More UI complexity
**Effort**: Medium
**Risk**: Low

### Option 3: Simple Switch to scheduled_date Only
Filter only by `scheduled_date`, hide unscheduled services from date filters.

**Pros**: Simplest implementation
**Cons**: Unscheduled services only visible in "All"
**Effort**: Small
**Risk**: Medium (could miss urgent unscheduled services)

## Recommended Action

Option 1 - Filter by `scheduled_date` with fallback to `created_at` for unscheduled services.

## Technical Details

**Affected Files**:
- `src/routes/courier/+page.svelte`

**Query Considerations**:
- Services with `scheduled_date` should be filtered/sorted by that date
- Services without `scheduled_date` (immediate) should use `created_at`
- Consider showing time slot in the list

## Acceptance Criteria

- [ ] "Today" shows services scheduled for today
- [ ] "Tomorrow" shows services scheduled for tomorrow
- [ ] Unscheduled services appear based on created_at
- [ ] List is ordered by scheduled time, then created time
- [ ] Works correctly for services with/without scheduling

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | Filter by created_at is not operationally useful |

## Resources

- Current implementation: `src/routes/courier/+page.svelte`
