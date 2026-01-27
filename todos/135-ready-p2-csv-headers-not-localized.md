---
status: ready
priority: p2
issue_id: "135"
tags: [i18n, csv-export]
dependencies: []
---

# CSV Export Headers Not Localized on Services Page

## Problem Statement
The new CSV export on the courier services page uses hardcoded English headers (`['Date', 'Client', 'Pickup', ...]`). Both existing CSV exports (courier billing and client billing) use `m.*()` i18n functions for headers. This is inconsistent.

## Findings
- Location: `src/routes/courier/services/+page.svelte:280`
- Courier billing CSV uses: `m.billing_client()`, `m.billing_services()`, etc.
- Client billing CSV uses: `m.reports_table_date()`, `m.reports_table_route()`, etc.
- New services CSV uses: `['Date', 'Client', 'Pickup', 'Delivery', 'Distance (km)', 'Price', 'Status']`

## Proposed Solutions

### Option 1: Add i18n message keys for CSV headers
- Add message keys like `csv_date`, `csv_client`, `csv_pickup`, `csv_delivery`, `csv_distance`, `csv_price`, `csv_status` or reuse existing ones where available
- **Pros**: Consistent with existing CSV exports
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Add or reuse i18n message keys and replace the hardcoded English headers.

## Technical Details
- **Affected Files**: `src/routes/courier/services/+page.svelte`, `messages/en.json`, `messages/pt-PT.json`
- **Database Changes**: No

## Acceptance Criteria
- [ ] CSV headers display in the user's selected locale
- [ ] Consistent with courier billing and client billing CSV export patterns

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes
Source: UX audit implementation review on 2026-01-27
