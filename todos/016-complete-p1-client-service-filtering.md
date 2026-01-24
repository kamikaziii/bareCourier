# Client Cannot Filter or Search Services

---
status: complete
priority: p1
issue_id: "016"
tags: [code-review, ux, feature-parity, client]
dependencies: []
plan_task: "P3.2"
plan_status: "COMPLETED"
---

> **UX PLAN INTEGRATION**: This feature is task **P3.2** in the [UX Implementation Plan](../docs/plans/2026-01-23-ux-implementation-plan.md). Close this todo when P3.2 is completed.

## Problem Statement

The client dashboard shows all services in a single list with no ability to filter by status, date, or search by location. As clients accumulate more services, finding specific ones becomes difficult.

**Why it matters**: Courier has full filtering (status, client, search) while client has none. This is a significant UX disparity that makes the client experience frustrating for active users.

## Findings

- **Location**: `src/routes/client/+page.svelte`
- **Agent**: UX Review

**Current Client Dashboard**:
- Shows ALL services in one list
- No status filter (pending/delivered)
- No date filter (today/tomorrow/all)
- No search functionality
- Only sorting is by `created_at desc`

**Courier Services Page Has**:
```svelte
<!-- Filters in /courier/services -->
<Input type="search" placeholder={m.services_search()} bind:value={searchQuery} />
<select bind:value={statusFilter}>
  <option value="all">All Status</option>
  <option value="pending">Pending</option>
  <option value="delivered">Delivered</option>
</select>
```

## Proposed Solutions

### Option 1: Add Filtering Matching Courier (Recommended)
Add status filter and search box to client dashboard.

**Implementation**:
```svelte
<script lang="ts">
  let statusFilter = $state<'all' | 'pending' | 'delivered'>('all');
  let searchQuery = $state('');

  const filteredServices = $derived(
    services.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesPickup = s.pickup_location?.toLowerCase().includes(query);
        const matchesDelivery = s.delivery_location?.toLowerCase().includes(query);
        if (!matchesPickup && !matchesDelivery) return false;
      }
      return true;
    })
  );
</script>

<!-- Before services list -->
<div class="flex flex-wrap gap-4">
  <div class="flex-1 min-w-[200px]">
    <Input
      type="search"
      placeholder={m.services_search()}
      bind:value={searchQuery}
    />
  </div>
  <select
    bind:value={statusFilter}
    class="h-10 rounded-md border border-input bg-background px-3 text-sm"
  >
    <option value="all">{m.services_all_status()}</option>
    <option value="pending">{m.status_pending()}</option>
    <option value="delivered">{m.status_delivered()}</option>
  </select>
</div>
```

**Pros**: Matches courier UX, familiar pattern, simple implementation
**Cons**: None
**Effort**: Small
**Risk**: Low

### Option 2: Add Date Quick Filters (Like Courier Dashboard)
Add Today/Tomorrow/All buttons similar to courier dashboard.

**Pros**: Quick access to common filters
**Cons**: Courier dashboard uses these but services page doesn't - may be redundant
**Effort**: Small
**Risk**: Low

### Option 3: Full Filter Panel
Add date range picker + status + search in collapsible panel.

**Pros**: Most powerful filtering
**Cons**: May be overkill for client needs
**Effort**: Medium
**Risk**: Low

## Recommended Action

Option 1 with elements of Option 2 - Add status filter + search, plus consider date quick filters for active clients.

## Technical Details

**Affected Files**:
- `src/routes/client/+page.svelte` - Add filter UI and logic

**i18n**: Reuse existing keys from courier:
- `m.services_search()`
- `m.services_all_status()`
- `m.services_showing()`

## Acceptance Criteria

- [ ] Client dashboard has search input for pickup/delivery locations
- [ ] Client dashboard has status dropdown (All/Pending/Delivered)
- [ ] Filtered count is shown ("Showing X services")
- [ ] Filters are responsive on mobile
- [ ] Filter state persists during session (optional)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | Major feature gap - courier has rich filtering, client has none |
| 2026-01-22 | Approved during triage | Status changed to ready - ready to implement |

## Resources

- Reference implementation: `src/routes/courier/services/+page.svelte` (lines 93-106)
