# Courier Dashboard Click-to-Toggle is Confusing UX

---
status: ready
priority: p2
issue_id: "019"
tags: [code-review, ux, courier]
dependencies: []
plan_task: "P3.4"
plan_status: "SUPERSEDED - Will be implemented as part of UX plan"
---

> **UX PLAN INTEGRATION**: This feature is task **P3.4** in the [UX Implementation Plan](../docs/plans/2026-01-23-ux-implementation-plan.md). Close this todo when P3.4 is completed.

## Problem Statement

On the courier dashboard, clicking a service card toggles its status between pending and delivered. This is unexpected behavior - users typically expect clicking a card to navigate to its detail page. The client dashboard correctly links to detail pages.

**Why it matters**:
1. Accidental status changes from misclicks
2. No way to view service details from dashboard without going to /courier/services
3. Inconsistent with client dashboard behavior

## Findings

- **Location**: `src/routes/courier/+page.svelte` (lines 131-166)
- **Agent**: UX Review

**Current Courier Dashboard**:
```svelte
<Card.Root class="overflow-hidden">
  <button
    class="w-full text-left"
    onclick={() => toggleStatus(service)}
  >
    <Card.Content class="flex items-start gap-4 p-4">
      <!-- service info -->
    </Card.Content>
  </button>
</Card.Root>
```

**Client Dashboard (Better Pattern)**:
```svelte
<a href={localizeHref(`/client/services/${service.id}`)} class="block">
  <Card.Root class="transition-colors hover:bg-muted/50">
    <Card.Content class="flex items-start gap-4 p-4">
      <!-- service info -->
    </Card.Content>
  </Card.Root>
</a>
```

## Proposed Solutions

### Option 1: Link to Detail + Quick Action Button (Recommended)
Make the card link to detail page, add small action button for quick status toggle.

**Implementation**:
```svelte
<a href={localizeHref(`/courier/services/${service.id}`)} class="block">
  <Card.Root class="transition-colors hover:bg-muted/50">
    <Card.Content class="flex items-start gap-4 p-4">
      <div class="mt-1 size-4 shrink-0 rounded-full {statusClass}"></div>
      <div class="min-w-0 flex-1">
        <!-- service info -->
      </div>
      <!-- Quick action button -->
      <button
        onclick={(e) => { e.preventDefault(); e.stopPropagation(); toggleStatus(service); }}
        class="shrink-0 rounded-md p-2 hover:bg-muted"
        title={service.status === 'pending' ? m.mark_delivered() : m.mark_pending()}
      >
        {#if service.status === 'pending'}
          <CheckCircle class="size-5 text-green-500" />
        {:else}
          <Circle class="size-5 text-blue-500" />
        {/if}
      </button>
    </Card.Content>
  </Card.Root>
</a>
```

**Pros**: Standard navigation pattern, quick action still available, matches client UX
**Cons**: Slightly more complex UI
**Effort**: Small
**Risk**: Low

### Option 2: Remove Quick Toggle Entirely
Just link to detail page, toggle only available on detail page.

**Pros**: Simplest, most consistent
**Cons**: Loses quick toggle convenience
**Effort**: Small
**Risk**: Low

### Option 3: Swipe to Toggle (Mobile)
Keep tap to navigate, add swipe gesture for status change.

**Pros**: Clean mobile UX
**Cons**: Complex to implement, not discoverable
**Effort**: High
**Risk**: Medium

## Recommended Action

Option 1 - Link card to detail page, add explicit toggle button.

## Technical Details

**Affected Files**:
- `src/routes/courier/+page.svelte`

**UI Changes**:
- Change `<button>` wrapper to `<a>` link
- Add small action button for quick toggle
- Prevent event propagation on button click

## Acceptance Criteria

- [ ] Clicking service card navigates to detail page
- [ ] Quick toggle button available for status change
- [ ] Toggle button click doesn't navigate (stopPropagation)
- [ ] Visual feedback on hover for both card and button
- [ ] Mobile-friendly touch targets

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | Click-to-toggle is non-standard, confusing |
| 2026-01-22 | Approved during triage | Status changed to ready - ready to implement |

## Resources

- Client pattern: `src/routes/client/+page.svelte` (lines 265-320)
