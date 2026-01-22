# Consolidate Courier Navigation (Reports/Analytics Overlap)

---
status: pending
priority: p3
issue_id: "023"
tags: [code-review, ux, navigation, courier]
dependencies: []
---

## Problem Statement

The courier navigation has 9 top-level items, including "Analytics" and "Reports" which show similar data in different formats. This creates navigation clutter and confusion about which section to use.

**Why it matters**: Too many navigation items makes the app harder to learn and use. Mobile users especially suffer from horizontal scroll on the nav bar.

## Findings

- **Location**: `src/routes/courier/+layout.svelte` (lines 17-27)
- **Agent**: UX Review

**Current Navigation (9 items)**:
```svelte
const navItems = $derived([
  { href: '/courier', label: m.nav_dashboard() },
  { href: '/courier/services', label: m.nav_services() },
  { href: '/courier/requests', label: m.nav_requests() },
  { href: '/courier/calendar', label: m.nav_calendar() },
  { href: '/courier/clients', label: m.nav_clients() },
  { href: '/courier/billing', label: m.nav_billing() },
  { href: '/courier/analytics', label: m.nav_analytics() },
  { href: '/courier/reports', label: m.nav_reports() },
  { href: '/courier/settings', label: m.nav_settings() }
]);
```

**Overlapping Sections**:
- **Analytics**: Charts (services over time, revenue over time, status distribution)
- **Reports**: Table with filters, CSV export, summary cards

Both show the same underlying data (services) with different visualizations.

## Proposed Solutions

### Option 1: Combine Reports + Analytics into "Insights" (Recommended)
Merge into one page with tabs for different views.

**Implementation**:
Create `/courier/insights/+page.svelte` with tabs:
- **Overview**: Summary cards (from Reports)
- **Charts**: All charts (from Analytics)
- **Data**: Table with export (from Reports)

Navigation becomes (7 items):
```svelte
const navItems = $derived([
  { href: '/courier', label: m.nav_dashboard() },
  { href: '/courier/services', label: m.nav_services() },
  { href: '/courier/requests', label: m.nav_requests() },
  { href: '/courier/calendar', label: m.nav_calendar() },
  { href: '/courier/clients', label: m.nav_clients() },
  { href: '/courier/billing', label: m.nav_billing() },
  { href: '/courier/insights', label: m.nav_insights() },
  { href: '/courier/settings', label: m.nav_settings() }
]);
```

**Pros**: Cleaner nav, related content together, better UX
**Cons**: Larger single page, migration work
**Effort**: Medium
**Risk**: Low

### Option 2: Group Navigation with Dropdown
Use dropdown menus to group related items.

Example groups:
- **Operations**: Dashboard, Services, Requests, Calendar
- **Clients**: Clients, Billing
- **Reports**: Analytics, Reports
- Settings

**Pros**: Keeps all pages, organized hierarchy
**Cons**: Extra click for some items, more complex UI
**Effort**: Medium
**Risk**: Low

### Option 3: Keep Separate but Rename
Keep both pages but make distinction clearer:
- "Analytics" → "Charts"
- "Reports" → "Export Data"

**Pros**: Minimal change
**Cons**: Doesn't reduce nav items
**Effort**: Small
**Risk**: Low

### Option 4: Bottom Navigation for Mobile
Add bottom nav on mobile, keep top nav on desktop.

**Pros**: Better mobile UX
**Cons**: Doesn't solve overlap issue
**Effort**: Medium
**Risk**: Low

## Recommended Action

Option 1 (Combine into Insights) for long-term, Option 3 (Rename) as quick fix.

## Technical Details

**For Option 1 - New Files**:
- `src/routes/courier/insights/+page.svelte`
- `src/routes/courier/insights/+page.ts`

**Deprecate**:
- `src/routes/courier/analytics/`
- `src/routes/courier/reports/`

**For Option 3 - Modify**:
- `src/routes/courier/+layout.svelte` (nav labels)
- i18n messages

## Acceptance Criteria

### Option 1:
- [ ] New Insights page with tabbed interface
- [ ] All analytics charts accessible
- [ ] All reports data + export accessible
- [ ] Old routes redirect to new page
- [ ] Navigation reduced to 7-8 items

### Option 3:
- [ ] "Analytics" renamed to "Charts"
- [ ] "Reports" renamed to "Export" or "Data Export"
- [ ] Updated i18n messages

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | 9 nav items is too many, Analytics/Reports overlap |

## Resources

- Current Analytics: `src/routes/courier/analytics/+page.svelte`
- Current Reports: `src/routes/courier/reports/+page.svelte`
