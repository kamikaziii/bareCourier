---
status: ready
priority: p1
issue_id: "136"
tags: [bug, pricing, edit-page]
dependencies: []
---

# Edit Page Does Not Recalculate Price

## Problem Statement
The edit page server action saves `distance_km` and `urgency_fee_id` but does NOT call `calculateServicePrice()` to recompute `calculated_price` or `price_breakdown`. The create action does call it. If a courier edits a service to change the delivery location (changing distance) or urgency fee, the stored price becomes stale and incorrect.

## Findings
- Location: `src/routes/courier/services/[id]/edit/+page.server.ts` — no call to `calculateServicePrice`
- Create action at `src/routes/courier/services/+page.server.ts:90` calls `calculateServicePrice()` and stores `calculated_price` + `price_breakdown`
- Edit action saves `distance_km`, `urgency_fee_id` but leaves `calculated_price` and `price_breakdown` unchanged
- Client will see a wrong price after the courier edits distance or urgency

## Proposed Solutions

### Option 1: Add price recalculation to the edit server action
- Import `calculateServicePrice`, `getCourierPricingSettings`, `getClientPricing` into the edit server
- After parsing form data and before the update query, compute the new price if distance_km is present
- Save `calculated_price` and `price_breakdown` alongside the other fields
- **Pros**: Full parity with create action
- **Cons**: Adds complexity to edit action
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1 — copy the pricing calculation pattern from the create action into the edit server action.

## Technical Details
- **Affected Files**: `src/routes/courier/services/[id]/edit/+page.server.ts`
- **Related Components**: pricing service (`$lib/services/pricing.js`)
- **Database Changes**: No

## Acceptance Criteria
- [ ] Editing a service with changed distance recalculates the price
- [ ] Editing a service with changed urgency fee recalculates the price
- [ ] `calculated_price` and `price_breakdown` are updated in the database
- [ ] Matches create action behavior

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Marked P1 because it causes incorrect pricing data visible to clients

## Notes
Source: UX audit implementation review on 2026-01-27
