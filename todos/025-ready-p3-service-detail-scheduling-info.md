# Service Detail Pages Missing Scheduling Info Display

---
status: ready
priority: p3
issue_id: "025"
tags: [code-review, ux, client]
dependencies: []
plan_task: "N/A"
plan_status: "POST-PLAN - Polish task for after Phase 3 (Client Features)"
---

> **UX PLAN INTEGRATION**: This is a **POST-PLAN** polish task to be done after Phase 3 (Client Features) of the [UX Implementation Plan](../docs/plans/2026-01-23-ux-implementation-plan.md). P3.1 (Client Cancellation) modifies the client service detail page, so this enhancement should be done after P3.1 is complete to avoid conflicts.

## Problem Statement

The client service detail page (`/client/services/[id]`) doesn't display scheduling information (requested date, scheduled date, time slots). While this data exists in the database and is shown in the dashboard list, it's not visible on the detail page.

**Why it matters**: When a client views a service detail, they should see all relevant information including when they requested it and when it's scheduled.

## Findings

- **Location**: `src/routes/client/services/[id]/+page.svelte`
- **Agent**: UX Review

**Client Dashboard Shows**:
```svelte
{#if service.scheduled_date}
  <p class="mt-1 text-xs text-muted-foreground">
    {m.requests_scheduled()}: {formatDate(service.scheduled_date)}
    {#if service.scheduled_time_slot}
      - {formatTimeSlot(service.scheduled_time_slot)}
    {/if}
  </p>
{/if}
```

**Client Service Detail Page Missing**:
- Requested date/time (what client asked for)
- Scheduled date/time (what's confirmed)
- Request status badge (pending/accepted/rejected/suggested)
- Suggested date/time (if courier suggested alternative)

**Courier Service Detail Shows More Info**:
- Client info section
- Status change actions
- But also doesn't show scheduling details (both need improvement)

## Proposed Solutions

### Option 1: Add Scheduling Card to Detail Page (Recommended)
Add a new card section showing all scheduling information.

**Implementation**:
```svelte
<!-- Scheduling Info -->
{#if service.requested_date || service.scheduled_date}
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <Calendar class="size-5" />
        {m.scheduling_info()}
      </Card.Title>
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if service.requested_date}
        <div>
          <p class="text-sm font-medium text-muted-foreground">{m.client_your_request()}</p>
          <p class="mt-1">
            {formatDate(service.requested_date)}
            {#if service.requested_time_slot}
              - {formatTimeSlot(service.requested_time_slot)}
            {/if}
          </p>
        </div>
      {/if}

      {#if service.scheduled_date}
        <Separator />
        <div>
          <p class="text-sm font-medium text-muted-foreground">{m.requests_scheduled()}</p>
          <p class="mt-1 font-medium text-green-600">
            {formatDate(service.scheduled_date)}
            {#if service.scheduled_time_slot}
              - {formatTimeSlot(service.scheduled_time_slot)}
            {/if}
          </p>
        </div>
      {/if}

      {#if service.request_status === 'suggested' && service.suggested_date}
        <Separator />
        <div class="rounded-lg bg-orange-500/10 p-3">
          <p class="text-sm font-medium text-orange-600">{m.client_courier_suggests()}</p>
          <p class="mt-1">
            {formatDate(service.suggested_date)}
            {#if service.suggested_time_slot}
              - {formatTimeSlot(service.suggested_time_slot)}
            {/if}
          </p>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
{/if}
```

Also add request status badge to the status card:
```svelte
{#if service.request_status && service.request_status !== 'accepted'}
  <Badge variant="outline" class={getRequestStatusColor(service.request_status)}>
    {getRequestStatusLabel(service.request_status)}
  </Badge>
{/if}
```

**Pros**: Complete information display, matches dashboard info
**Cons**: More UI elements
**Effort**: Small
**Risk**: Low

## Recommended Action

Option 1 - Add scheduling card. This ensures the detail page shows all relevant information.

## Technical Details

**Affected Files**:
- `src/routes/client/services/[id]/+page.svelte`
- Optionally: `src/routes/courier/services/[id]/+page.svelte` (similar enhancement)

**Helper Functions to Add** (copy from dashboard):
```typescript
function formatTimeSlot(slot: string | null): string {
  if (!slot) return '';
  switch (slot) {
    case 'morning': return m.time_slot_morning();
    case 'afternoon': return m.time_slot_afternoon();
    case 'evening': return m.time_slot_evening();
    case 'specific': return m.time_slot_specific();
    default: return slot;
  }
}

function getRequestStatusLabel(status: string): string { /* ... */ }
function getRequestStatusColor(status: string): string { /* ... */ }
```

**i18n Keys** (may already exist):
- `scheduling_info`
- `client_your_request`
- `requests_scheduled`
- `client_courier_suggests`
- `time_slot_*`

## Acceptance Criteria

- [ ] Client service detail shows requested date/time if set
- [ ] Client service detail shows scheduled date/time if set
- [ ] Client service detail shows suggested date/time if courier suggested
- [ ] Request status badge visible when not accepted
- [ ] Time slots display with localized labels
- [ ] Optional: Same enhancement for courier detail page

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | Detail page missing scheduling info shown on dashboard |
| 2026-01-22 | Approved during triage | Status changed to ready - ready to implement |

## Resources

- Dashboard implementation: `src/routes/client/+page.svelte`
- Courier requests page: `src/routes/courier/requests/+page.svelte`
