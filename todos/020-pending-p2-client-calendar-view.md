# Client Missing Calendar View

---
status: pending
priority: p2
issue_id: "020"
tags: [code-review, ux, feature-parity, client]
dependencies: []
---

## Problem Statement

The courier has a calendar view (`/courier/calendar`) to see scheduled services on a monthly calendar. Clients have no similar view - they can only see their services in a list format.

**Why it matters**: Clients who schedule multiple services would benefit from seeing them on a calendar. This is especially useful for businesses that have regular pickup schedules.

## Findings

- **Location**: `src/routes/courier/calendar/+page.svelte` (exists)
- **Location**: `src/routes/client/calendar/` (does not exist)
- **Agent**: UX Review

**Courier Has**:
- Monthly calendar view
- Services displayed on their scheduled dates
- Navigation between months
- Click on date to see services for that day

**Client Has**:
- List view only
- No calendar visualization
- No quick way to see "what's scheduled for next week"

## Proposed Solutions

### Option 1: Simple Calendar View (Recommended)
Create a basic calendar view for clients showing their scheduled services.

**Implementation**:
Create `src/routes/client/calendar/+page.svelte`:
```svelte
<script lang="ts">
  import * as Card from '$lib/components/ui/card/index.js';
  import { Calendar } from '$lib/components/ui/calendar/index.js';
  import * as m from '$lib/paraglide/messages.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let services = $state<Service[]>([]);
  let selectedDate = $state<Date>(new Date());

  // Load services with scheduled dates
  async function loadServices() {
    const { data: result } = await data.supabase
      .from('services')
      .select('*')
      .is('deleted_at', null)
      .not('scheduled_date', 'is', null)
      .order('scheduled_date');
    services = result || [];
  }

  // Services for selected date
  const servicesForDate = $derived(
    services.filter(s => {
      const serviceDate = new Date(s.scheduled_date);
      return serviceDate.toDateString() === selectedDate.toDateString();
    })
  );

  // Dates that have services (for calendar marking)
  const datesWithServices = $derived(
    new Set(services.map(s => new Date(s.scheduled_date).toDateString()))
  );
</script>
```

Add to client navigation:
```svelte
const navItems = $derived([
  { href: '/client', label: m.nav_my_services() },
  { href: '/client/new', label: m.nav_new_request() },
  { href: '/client/calendar', label: m.nav_calendar() },  // Add this
  { href: '/client/billing', label: m.nav_billing() },
  { href: '/client/settings', label: m.nav_settings() }
]);
```

**Pros**: Feature parity, useful for planning, reuses existing Calendar component
**Cons**: Additional page to maintain
**Effort**: Medium
**Risk**: Low

### Option 2: Calendar Widget on Dashboard
Add a small calendar widget to the existing dashboard instead of separate page.

**Pros**: Keeps everything on one page
**Cons**: May clutter dashboard, less space for calendar
**Effort**: Medium
**Risk**: Low

### Option 3: Copy Courier Calendar (Full Feature)
Direct copy of courier calendar with RLS filtering.

**Pros**: Fastest implementation
**Cons**: May have features client doesn't need
**Effort**: Small
**Risk**: Low

## Recommended Action

Option 3 initially (quick win), then refine to Option 1 if needed.

## Technical Details

**New Files**:
- `src/routes/client/calendar/+page.svelte`
- `src/routes/client/calendar/+page.ts` (optional, for load function)

**Modify Files**:
- `src/routes/client/+layout.svelte` - Add calendar to navigation

**Note**: RLS already ensures clients only see their own services, so the calendar will automatically be filtered.

## Acceptance Criteria

- [ ] Client has calendar link in navigation
- [ ] Calendar shows month view with service indicators
- [ ] Clicking a date shows services scheduled for that day
- [ ] Only shows services with scheduled_date set
- [ ] Proper i18n for new navigation item

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | Courier has calendar, client doesn't |

## Resources

- Reference: `src/routes/courier/calendar/+page.svelte`
- Calendar component: `src/lib/components/ui/calendar/`
