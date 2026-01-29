---
status: complete
priority: p2
issue_id: "113"
tags: [edit-form, type-pricing, data-integrity, consistency]
dependencies: []
---

# Hidden Fields Sent Regardless of Pricing Mode in Edit Form

## Problem Statement
Type-based pricing hidden fields are always submitted in the edit form, regardless of the current pricing mode. This could corrupt service data when switching pricing modes.

## Findings
- Location: `src/routes/courier/services/[id]/edit/+page.svelte:387-391`
- Edit form: Hidden fields NOT wrapped in `{#if isTypePricingMode}`
- New form (`new/+page.svelte:442-446`): Correctly wrapped in conditional

## Problem Scenario
1. Service created in type-based pricing mode
2. Courier switches to distance-based pricing mode
3. Courier edits the service
4. Type fields (`service_type_id`, `is_out_of_zone`, etc.) still sent
5. Fields may get cleared or set to empty/false values
6. Existing type-based pricing data corrupted

## Proposed Solutions

### Option 1: Wrap hidden fields in conditional (Recommended)
```svelte
<!-- Type-based pricing hidden fields - only send in type mode -->
{#if isTypePricingMode}
    <input type="hidden" name="service_type_id" value={serviceTypeId} />
    <input type="hidden" name="is_out_of_zone" value={isOutOfZone ?? ''} />
    <input type="hidden" name="tolls" value={tolls} />
    <input type="hidden" name="detected_municipality" value={detectedMunicipality ?? ''} />
    <input type="hidden" name="has_time_preference" value={hasTimePreference} />
{/if}
```

Also update server action to conditionally update type fields:
```typescript
if (courierSettings.pricingMode === 'type') {
    updateData.service_type_id = service_type_id || null;
    // ... other type fields
}
```
- **Pros**: Prevents data corruption, consistent with new form
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1: Wrap in conditional on both client and server sides.

## Technical Details
- **Affected Files**:
  - `src/routes/courier/services/[id]/edit/+page.svelte`
  - `src/routes/courier/services/[id]/edit/+page.server.ts`
- **Related Components**: None
- **Database Changes**: No

## Resources
- Original finding: Pricing Audit 2025-01-29 (M2)
- Reference: New service form implementation

## Acceptance Criteria
- [ ] Hidden fields wrapped in `{#if isTypePricingMode}`
- [ ] Server action conditionally updates type fields
- [ ] Switching pricing modes doesn't corrupt existing data
- [ ] Tests pass

## Work Log

### 2025-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Medium priority for data integrity

## Notes
Source: Pricing Audit findings verification 2025-01-29
