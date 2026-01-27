---
status: ready
priority: p2
issue_id: "133"
tags: [bug, performance, edit-page]
dependencies: []
---

# Double Route API Call on Edit Page

## Problem Statement
The edit page has an `$effect` that tracks `pickupCoords` and `deliveryCoords` and calls `calculateRoute()`. When the user picks a new address, `handlePickupSelect` also sets those coords and calls `calculateRouteIfReady()`, which internally calls `calculateRoute()` again. Two parallel HTTP requests fire to the OpenRouteService API for the same coordinates on every address change.

## Findings
- Location: `src/routes/courier/services/[id]/edit/+page.svelte:79-85`
- The `$effect` was added to load initial route geometry for pre-existing coords on mount
- It conflicts with the handler-driven flow in `handlePickupSelect`/`handleDeliverySelect`
- The create page does NOT have this effect — it only calls `calculateRouteIfReady()` from handlers

## Proposed Solutions

### Option 1: Guard the effect with a flag
- Add a `initialRouteLoaded` flag, set to true after first run
- **Pros**: Minimal change, keeps initial load behavior
- **Cons**: Extra state variable
- **Effort**: Small
- **Risk**: Low

### Option 2: Remove the effect entirely, call calculateRouteIfReady on mount
- Use `onMount` or a single guarded `$effect` that runs once
- **Pros**: Matches the create page pattern exactly
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 2 — remove the `$effect` and call `calculateRouteIfReady()` once from a mount-only pattern.

## Technical Details
- **Affected Files**: `src/routes/courier/services/[id]/edit/+page.svelte`
- **Related Components**: RouteMap, AddressInput
- **Database Changes**: No

## Acceptance Criteria
- [ ] Initial route geometry loads on mount for services with existing coords
- [ ] Changing an address fires only one route API call
- [ ] No regression on create page behavior

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes
Source: UX audit implementation review on 2026-01-27
