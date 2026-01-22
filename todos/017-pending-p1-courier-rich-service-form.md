# Courier Service Creation Lacks Rich Form Features

---
status: pending
priority: p1
issue_id: "017"
tags: [code-review, ux, feature-parity, courier]
dependencies: []
---

## Problem Statement

When the courier creates a service on behalf of a client, the form is basic: plain text inputs for locations, no map preview, no distance calculation, no scheduling options. Meanwhile, the client's service request form has address autocomplete, route map preview, distance calculation, and schedule picker.

**Why it matters**: The courier should have the same (or better) tools when creating services. Currently the courier experience is inferior to the client's for the same task.

## Findings

- **Location**: `src/routes/courier/services/+page.svelte` (lines 125-193)
- **Agent**: UX Review

**Courier Create Form Has**:
- Client dropdown (good)
- Plain text input for pickup location
- Plain text input for delivery location
- Plain text input for notes
- Auto-fills pickup from client's default (good)

**Courier Create Form Missing**:
- AddressInput component (autocomplete)
- RouteMap component (preview)
- Distance calculation
- SchedulePicker component
- Coordinates stored for routing

**Client Create Form Has**:
```svelte
<AddressInput
  id="pickup"
  bind:value={pickupLocation}
  onSelect={handlePickupSelect}
  placeholder={m.form_pickup_placeholder()}
/>

<RouteMap
  {pickupCoords}
  {deliveryCoords}
  {routeGeometry}
  {distanceKm}
  height="200px"
/>

<SchedulePicker
  selectedDate={requestedDate}
  selectedTimeSlot={requestedTimeSlot}
  selectedTime={requestedTime}
  onDateChange={(date) => (requestedDate = date)}
  onTimeSlotChange={(slot) => (requestedTimeSlot = slot)}
  onTimeChange={(time) => (requestedTime = time)}
/>
```

## Proposed Solutions

### Option 1: Full Feature Parity (Recommended)
Add all components from client form to courier form.

**Implementation Changes**:

1. Import components:
```svelte
import AddressInput from '$lib/components/AddressInput.svelte';
import RouteMap from '$lib/components/RouteMap.svelte';
import SchedulePicker from '$lib/components/SchedulePicker.svelte';
import { calculateRoute, calculateHaversineDistance } from '$lib/services/distance.js';
```

2. Add state for coordinates and scheduling:
```svelte
let pickupCoords = $state<[number, number] | null>(null);
let deliveryCoords = $state<[number, number] | null>(null);
let distanceKm = $state<number | null>(null);
let routeGeometry = $state<string | null>(null);
let scheduledDate = $state<string | null>(null);
let scheduledTimeSlot = $state<TimeSlot | null>(null);
let scheduledTime = $state<string | null>(null);
```

3. Replace plain inputs with AddressInput
4. Add RouteMap when both coords available
5. Add SchedulePicker section
6. Include coordinates and distance in insert

**Pros**: Full feature parity, better UX, accurate distance data
**Cons**: More complex form, requires Mapbox token
**Effort**: Medium
**Risk**: Low

### Option 2: Separate Full-Featured Create Page
Create dedicated `/courier/services/new` page with full form instead of inline form.

**Pros**: Cleaner separation, more room for full form
**Cons**: Additional navigation step
**Effort**: Medium
**Risk**: Low

## Recommended Action

Option 1 - Add rich form features to existing inline form. The form expands when "New Service" is clicked, so there's room for the additional components.

## Technical Details

**Affected Files**:
- `src/routes/courier/services/+page.svelte` - Upgrade create form

**Components to Add**:
- AddressInput (already exists)
- RouteMap (already exists)
- SchedulePicker (already exists)

**Database Fields Used** (already exist):
- `pickup_lat`, `pickup_lng`
- `delivery_lat`, `delivery_lng`
- `distance_km`
- `scheduled_date`, `scheduled_time_slot`, `scheduled_time`

**Note**: When courier creates service, it should use `scheduled_*` fields (not `requested_*`), since it's a confirmed schedule, not a request.

## Acceptance Criteria

- [ ] Courier create form has address autocomplete for pickup/delivery
- [ ] Route map preview shown when both addresses selected
- [ ] Distance is calculated and displayed
- [ ] Schedule picker available for setting delivery date/time
- [ ] Coordinates and distance saved to database
- [ ] Form works gracefully without Mapbox token (falls back to plain input)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | Courier form significantly inferior to client form |

## Resources

- Reference: `src/routes/client/new/+page.svelte` (full implementation)
- Components: `src/lib/components/AddressInput.svelte`, `RouteMap.svelte`, `SchedulePicker.svelte`
