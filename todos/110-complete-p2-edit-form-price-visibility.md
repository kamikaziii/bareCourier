---
status: complete
priority: p2
issue_id: "110"
tags: [price-visibility, edit-form, type-pricing, consistency]
dependencies: []
---

# Service Edit Form Doesn't Respect Price Visibility Setting

## Problem Statement
The service edit form shows `TypePricePreview` unconditionally, ignoring the `show_price_to_courier` setting. The new service form correctly checks this setting, but the edit form doesn't.

## Findings
- Location: `src/routes/courier/services/[id]/edit/+page.svelte:354-364`
- Edit form: `{#if isTypePricingMode && selectedServiceType}` (missing visibility check)
- New form: `{#if isTypePricingMode && selectedServiceType && data.showPriceToCourier}` (correct)
- Server load at `edit/+page.server.ts:46-47` doesn't fetch `show_price_to_courier`

## Problem Scenario
1. Courier disables price visibility for themselves in settings
2. New service form correctly hides price preview
3. Edit service form still shows price preview
4. Inconsistent UX between create and edit flows

## Proposed Solutions

### Option 1: Add visibility check (Recommended)
1. Update server load to fetch `show_price_to_courier`:
```typescript
const { data: courierProfile } = await supabase
    .from('profiles')
    .select('pricing_mode, time_specific_price, out_of_zone_base, out_of_zone_per_km, show_price_to_courier')
    .eq('role', 'courier')
    .limit(1)
    .single();

return {
    // ... existing fields
    showPriceToCourier: courierProfile?.show_price_to_courier ?? true
};
```

2. Update template:
```svelte
{#if isTypePricingMode && selectedServiceType && data.showPriceToCourier}
    <TypePricePreview ... />
{/if}
```
- **Pros**: Consistent with new form, respects settings
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1: Add the visibility check to both server and client.

## Technical Details
- **Affected Files**:
  - `src/routes/courier/services/[id]/edit/+page.svelte`
  - `src/routes/courier/services/[id]/edit/+page.server.ts`
- **Related Components**: TypePricePreview
- **Database Changes**: No

## Resources
- Original finding: Pricing Audit 2025-01-29 (H1)
- Related: New service form implementation for reference

## Acceptance Criteria
- [ ] Server load fetches `show_price_to_courier`
- [ ] Template checks visibility before showing TypePricePreview
- [ ] Edit form behavior matches new form behavior
- [ ] Tests pass

## Work Log

### 2025-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- High priority due to settings not being respected

## Notes
Source: Pricing Audit findings verification 2025-01-29
