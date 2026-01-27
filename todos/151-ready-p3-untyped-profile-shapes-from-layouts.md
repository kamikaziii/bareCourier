---
status: ready
priority: p3
issue_id: "151"
tags: [architecture, type-safety]
dependencies: []
---

# Untyped and Inconsistent Profile Shapes from Layout Servers

## Problem Statement
Courier layout returns profile with 11 fields (id, role, name, past_due_settings, time_slots, working_days, timezone, vat_enabled, vat_rate, prices_include_vat, show_price_to_courier, show_price_to_client). Client returns 4 fields (id, role, name, default_pickup_location). Neither matches app.d.ts PageData['profile']. These are ad-hoc inline object literals with no shared type.

## Findings
- Source: Architecture Strategist (full review 2026-01-27)
- Locations:
  - `src/routes/courier/+layout.server.ts:38-51`
  - `src/routes/client/+layout.server.ts:51-56`
  - `src/app.d.ts`

## Proposed Solutions

### Option 1: Define discriminated union types
- Create `CourierLayoutProfile` and `ClientLayoutProfile` types
- Update app.d.ts PageData['profile'] to use the union
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Acceptance Criteria
- [ ] Typed profile shapes for both roles
- [ ] app.d.ts matches actual returned data
- [ ] Downstream consumers type-safe
