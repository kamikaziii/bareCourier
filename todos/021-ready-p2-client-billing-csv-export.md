# Client Billing Missing CSV Export

---
status: ready
priority: p2
issue_id: "021"
tags: [code-review, ux, feature-parity, client]
dependencies: []
plan_task: "P3.3"
plan_status: "SUPERSEDED - Will be implemented as part of UX plan"
---

> **UX PLAN INTEGRATION**: This feature is task **P3.3** in the [UX Implementation Plan](../docs/plans/2026-01-23-ux-implementation-plan.md). Close this todo when P3.3 is completed.

## Problem Statement

The courier billing page has CSV export functionality, but the client billing page does not. Clients may need to export their billing data for expense tracking, accounting, or record-keeping.

**Why it matters**: Business clients often need to reconcile courier expenses with their own accounting systems. Without export, they must manually transcribe data.

## Findings

- **Location**: `src/routes/courier/billing/+page.svelte` (has export)
- **Location**: `src/routes/client/billing/+page.svelte` (no export)
- **Agent**: UX Review

**Courier Billing Has**:
```svelte
<Button onclick={exportCSV} disabled={sortedBilling.length === 0}>
  <FileText class="mr-2 size-4" />
  {m.billing_export_csv()}
</Button>

function exportCSV() {
  const headers = [
    m.billing_client(),
    m.billing_services(),
    m.billing_delivered(),
    m.billing_total_km(),
    m.billing_estimated_cost()
  ];
  // ... CSV generation
}
```

**Client Billing Has**:
- Summary cards
- Service list table
- No export button
- No export function

## Proposed Solutions

### Option 1: Add CSV Export to Client Billing (Recommended)
Add the same export functionality adapted for client view.

**Implementation**:
```svelte
import { FileText } from '@lucide/svelte';

function exportCSV() {
  const headers = [
    m.reports_table_date(),
    m.form_pickup_location(),
    m.form_delivery_location(),
    m.billing_distance(),
    m.billing_price(),
    m.reports_status()
  ];

  const rows = services.map((s) => [
    new Date(s.created_at).toLocaleDateString(getLocale()),
    s.pickup_location,
    s.delivery_location,
    (s.distance_km || 0).toFixed(1),
    (s.calculated_price || 0).toFixed(2),
    s.status === 'pending' ? m.status_pending() : m.status_delivered()
  ]);

  // Add totals row
  rows.push(['', '', '', '', '']);
  rows.push([
    m.billing_total(),
    '',
    '',
    totals.km.toFixed(1),
    totals.cost.toFixed(2),
    ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `my_billing_${startDate}_to_${endDate}.csv`;
  link.click();
}
```

Add button to header:
```svelte
<div class="flex items-center justify-between">
  <div class="flex items-center gap-2">
    <Receipt class="size-6" />
    <h1 class="text-2xl font-bold">{m.client_billing_title()}</h1>
  </div>
  <Button onclick={exportCSV} disabled={services.length === 0}>
    <FileText class="mr-2 size-4" />
    {m.billing_export_csv()}
  </Button>
</div>
```

**Pros**: Feature parity, useful for clients, simple implementation
**Cons**: None
**Effort**: Small
**Risk**: Low

## Recommended Action

Option 1 - Add CSV export. This is a straightforward addition with clear business value.

## Technical Details

**Affected Files**:
- `src/routes/client/billing/+page.svelte`

**Dependencies**:
- Import `FileText` icon from lucide-svelte (already in courier version)

**i18n**: Reuse existing keys:
- `m.billing_export_csv()`

## Acceptance Criteria

- [ ] Export button visible in client billing page header
- [ ] Button disabled when no services in date range
- [ ] CSV includes all columns from the table
- [ ] CSV includes totals row
- [ ] Filename includes date range
- [ ] Works in both PT and EN locales

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | Courier has CSV export, client doesn't |
| 2026-01-22 | Approved during triage | Status changed to ready - ready to implement |

## Resources

- Reference: `src/routes/courier/billing/+page.svelte` (exportCSV function)
- Existing todo: `014-ready-p3-add-csv-export-api.md` (related API endpoint)
