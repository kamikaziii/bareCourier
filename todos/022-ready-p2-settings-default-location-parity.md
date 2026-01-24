# Settings: Client Has Default Location, Courier Doesn't

---
status: ready
priority: p2
issue_id: "022"
tags: [code-review, ux, feature-parity, settings]
dependencies: []
plan_task: "P5B.1"
plan_status: "POST-PLAN - Can be done alongside P5B.1 (Pricing Mode Setting)"
---

> **UX PLAN INTEGRATION**: This todo can be implemented alongside **P5B.1** (Add Pricing Mode to Courier Settings) in the [UX Implementation Plan](../docs/plans/2026-01-23-ux-implementation-plan.md). Since both modify the courier settings page, it makes sense to combine this work with P5B.1 to avoid touching the same file twice.

## Problem Statement

Client settings page has a "Default Pickup Location" field that auto-populates new service requests. Courier settings page doesn't have an equivalent "Default Warehouse/Start Location" that could be useful for route planning or as a default pickup when creating services.

**Why it matters**: The courier may have a warehouse or base location that's commonly used. Having this pre-configured would speed up service creation.

## Findings

- **Location**: `src/routes/client/settings/+page.svelte` (has default location)
- **Location**: `src/routes/courier/settings/+page.svelte` (no default location)
- **Agent**: UX Review

**Client Settings Has**:
```svelte
<!-- Default Location -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <MapPin class="size-5" />
      {m.settings_default_location()}
    </Card.Title>
    <Card.Description>{m.settings_default_location_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form method="POST" action="?/updateProfile" use:enhance class="space-y-4">
      <Textarea
        id="default_pickup_location"
        name="default_pickup_location"
        value={data.profile.default_pickup_location || ''}
        placeholder={m.form_pickup_placeholder()}
      />
    </form>
  </Card.Content>
</Card.Root>
```

**Courier Settings Has**:
- Profile section (name, phone)
- Email (read-only)
- Urgency fees management
- NO default location

**Database**:
The `profiles` table already has `default_pickup_location` column which works for both roles.

## Proposed Solutions

### Option 1: Add Default Location to Courier Settings (Recommended)
Add the same default location card to courier settings.

**Implementation**:
Copy the Default Location card from client settings to courier settings, positioned after Profile and before Urgency Fees:

```svelte
<!-- Default Location -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <MapPin class="size-5" />
      {m.settings_default_location()}
    </Card.Title>
    <Card.Description>{m.settings_courier_default_location_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form method="POST" action="?/updateProfile" use:enhance class="space-y-4">
      <input type="hidden" name="name" value={data.profile.name} />
      <input type="hidden" name="phone" value={data.profile.phone || ''} />
      <div class="space-y-2">
        <Label for="default_pickup_location">{m.settings_warehouse_address()}</Label>
        <Textarea
          id="default_pickup_location"
          name="default_pickup_location"
          value={data.profile.default_pickup_location || ''}
          placeholder={m.form_warehouse_placeholder()}
        />
        <p class="text-xs text-muted-foreground">{m.settings_warehouse_hint()}</p>
      </div>
      <Button type="submit">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>
```

Use this location:
- As default pickup when creating services (if no client default)
- For route optimization (start/end point)
- For mileage calculations

**Pros**: Consistent settings experience, useful for operations
**Cons**: May not be needed if courier always picks up from clients
**Effort**: Small
**Risk**: Low

### Option 2: Skip - Not Needed
The courier always picks up from client locations, so a default courier location isn't useful.

**Pros**: No work needed
**Cons**: Misses potential UX improvement
**Effort**: None
**Risk**: None

## Recommended Action

Option 1 - Add default location to courier settings. Even if not immediately used, it creates consistency and enables future route optimization features.

## Technical Details

**Affected Files**:
- `src/routes/courier/settings/+page.svelte`

**i18n Keys Needed**:
- `settings_courier_default_location_desc` (e.g., "Your base location for deliveries")
- `settings_warehouse_address`
- `form_warehouse_placeholder`
- `settings_warehouse_hint`

**Server Action**: Already exists (`?/updateProfile`) and handles `default_pickup_location`.

## Acceptance Criteria

- [ ] Courier settings has Default Location card
- [ ] Location saved to profile
- [ ] Appropriate i18n messages
- [ ] Future: Used as fallback when creating services

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | Client has default location, courier doesn't - inconsistency |
| 2026-01-22 | Approved during triage | Status changed to ready - ready to implement |

## Resources

- Reference: `src/routes/client/settings/+page.svelte`
