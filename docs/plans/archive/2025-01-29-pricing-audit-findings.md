# Type-Based Pricing Audit Findings

**Date:** 2025-01-29
**Status:** Pending Fixes
**Auditor:** Claude
**Audit Type:** Full UX + Implementation Verification

---

## Related Documents

| Document | Path | Purpose |
|----------|------|---------|
| Design Spec | `docs/plans/2025-01-29-pricing-model-redesign.md` | Original requirements from Agostinho |
| Implementation Plan | `docs/plans/2025-01-29-type-based-pricing-implementation.md` | 29-task implementation plan |
| Audit Fixes (completed) | `docs/plans/2025-01-29-pricing-audit-fixes.md` | First round of fixes (all committed) |
| This Document | `docs/plans/2025-01-29-pricing-audit-findings.md` | Second audit findings |

---

## Commits Implemented (Unpushed)

```
f79e9d5 fix(pricing): respect price visibility settings
cfdb271 feat(service-edit): support type-based pricing fields
7731f8c feat(client-form): add price estimate section
ad0f8ec fix(i18n): add missing workload_no_date_requested translation key
48da50f feat(clients): add new client creation form
7e7a576 fix(TimePreferencePicker): show price warning on expansion
ce1b045 feat(service-details): add detailed price breakdown for type-based pricing
456a88f feat(courier-form): add live price preview for type-based pricing
4b5cb2f feat(zone-detection): add manual override when auto-detection fails
6ca1638 feat(i18n): add missing type-based pricing translations
1ecb92d feat: type-based pricing display and form state improvements
```

---

## Summary

- **Pages audited**: 18+ routes (courier and client)
- **User roles**: `courier`, `client`
- **Critical findings**: 1
- **High findings**: 2
- **Medium findings**: 2
- **Low findings**: 2

---

## Finding Details

### [CRITICAL] C1: Client service request fails silently if no default_service_type_id assigned

**Severity:** CRITICAL
**Status:** OPEN

**Location:**
- `src/routes/client/new/+page.server.ts:113-147`

**Issue:**
When pricing mode is `type` but the client has no `default_service_type_id`, the `service_type_id` variable is `null`. The `calculateTypedPrice` function returns an error if `serviceTypeId` is missing, but the code continues and creates a service with `calculated_price = null`.

**Code Path:**
```typescript
// Line 113-117
let service_type_id: string | null = null;

if (pricingMode === 'type') {
    // Get client's default service type for type-based pricing
    service_type_id = await getClientDefaultServiceTypeId(supabase, user.id);

    if (service_type_id) {  // <-- If null, this block is skipped
        // ... price calculation
    }
}
// Service is created anyway with null price
```

**Impact:**
- If courier switches to type-based pricing but hasn't assigned default service types to all existing clients
- Those clients can create requests but they'll have no price calculated
- Causes billing confusion and potentially unbilled services

**Recommendation:**
Option A - Block the request:
```typescript
if (pricingMode === 'type') {
    service_type_id = await getClientDefaultServiceTypeId(supabase, user.id);

    if (!service_type_id) {
        return fail(400, {
            error: 'no_service_type_assigned',
            message: 'Please contact the courier to assign a service type to your account.'
        });
    }
    // ... continue with price calculation
}
```

Option B - Fall back to first service type:
```typescript
if (pricingMode === 'type') {
    service_type_id = await getClientDefaultServiceTypeId(supabase, user.id);

    if (!service_type_id) {
        // Fall back to first active service type
        const types = await getServiceTypes(supabase);
        service_type_id = types.length > 0 ? types[0].id : null;
    }
    // ... continue
}
```

Option C - Show warning in client form UI before submission (in `+page.svelte`):
```svelte
{#if isTypePricingMode && !data.clientServiceType}
    <div class="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
        {m.client_no_service_type_warning()}
    </div>
{/if}
```

---

### [HIGH] H1: Service edit form doesn't respect price visibility setting

**Severity:** HIGH
**Status:** OPEN

**Location:**
- `src/routes/courier/services/[id]/edit/+page.svelte:354-364`
- `src/routes/courier/services/[id]/edit/+page.server.ts` (missing `showPriceToCourier` in load)

**Issue:**
The TypePricePreview component is shown unconditionally in the edit form:
```svelte
<!-- Line 354-364 -->
{#if isTypePricingMode && selectedServiceType}
    <Separator />
    <TypePricePreview
        settings={data.typePricingSettings}
        serviceType={selectedServiceType}
        {isOutOfZone}
        {hasTimePreference}
        {distanceKm}
        tolls={tolls ? parseFloat(tolls) : null}
    />
{/if}
```

Compare to the new service form which correctly checks:
```svelte
<!-- src/routes/courier/services/new/+page.svelte:407-417 -->
{#if isTypePricingMode && selectedServiceType && data.showPriceToCourier}
    <TypePricePreview ... />
{/if}
```

**Impact:**
- Design doc specifies "Price display respects show_price_to_client / show_price_to_courier settings"
- Price is shown even when courier has disabled price visibility for themselves

**Recommendation:**

1. Update server load to include `showPriceToCourier`:
```typescript
// src/routes/courier/services/[id]/edit/+page.server.ts
const { data: courierProfile } = await supabase
    .from('profiles')
    .select('pricing_mode, time_specific_price, out_of_zone_base, out_of_zone_per_km, show_price_to_courier')
    .eq('role', 'courier')
    .limit(1)
    .single();

// Add to return
return {
    // ... existing fields
    showPriceToCourier: courierProfile?.show_price_to_courier ?? true
};
```

2. Update page template:
```svelte
{#if isTypePricingMode && selectedServiceType && data.showPriceToCourier}
    <TypePricePreview ... />
{/if}
```

---

### [HIGH] H2: Time preference warning shows absolute amount, not surcharge

**Severity:** HIGH
**Status:** OPEN

**Location:**
- `src/lib/components/TimePreferencePicker.svelte:246-249`

**Issue:**
The warning message displays the TOTAL time preference price, not the SURCHARGE amount:

```svelte
<!-- Line 246-249 -->
{#if showPriceWarning && timePreferencePrice > 0}
    <p class="text-xs text-muted-foreground">
        {m.time_preference_surcharge({ amount: timePreferencePrice.toFixed(2) })}
    </p>
{/if}
```

**Expected (from design doc):**
```
⚠️ +€9.00 pela preferência de horário
```
(When base type price is €4, time preference price is €13, surcharge = €9)

**Actual:**
```
+€13.00 pela preferência de horário
```

**Impact:**
- Confusing for users - suggests the total is an additional charge
- Doesn't match the design specification

**Recommendation:**
```svelte
<!-- Calculate actual surcharge -->
{#if showPriceWarning && timePreferencePrice > 0}
    {@const surcharge = basePrice > 0 ? timePreferencePrice - basePrice : timePreferencePrice}
    {#if surcharge > 0}
        <p class="text-xs text-muted-foreground">
            {m.time_preference_surcharge({ amount: surcharge.toFixed(2) })}
        </p>
    {/if}
{/if}
```

Also update the later warning block (lines 284-306) to use the same logic.

---

### [MEDIUM] M1: Client service details page missing type-based pricing display

**Severity:** MEDIUM
**Status:** OPEN

**Location:**
- `src/routes/client/services/[id]/+page.svelte`
- `src/routes/client/services/[id]/+page.server.ts`

**Issue:**
The client's service detail view shows:
- Status badge
- Locations
- Scheduling info
- Notes
- Timestamps

But does NOT show (unlike courier's view):
- Service type name
- Zone status (in-zone / out-of-zone)
- Price breakdown

**Courier view shows (lines 372-462 of `/courier/services/[id]/+page.svelte`):**
```svelte
<!-- Type-based pricing detailed breakdown -->
{#if service.price_breakdown?.model === 'type'}
    <Separator class="my-4" />
    <div class="space-y-2 text-sm">
        <p class="font-medium text-muted-foreground">{m.price_breakdown()}</p>
        {#if service.service_types?.name}
            <div class="flex justify-between">
                <span class="text-muted-foreground">{m.service_type()}</span>
                <span class="font-medium">{service.service_types.name}</span>
            </div>
        {/if}
        <!-- ... zone status, breakdown details -->
    </div>
{/if}
```

**Impact:**
- Clients can't see what type of service they requested
- Clients can't see if their delivery is out-of-zone
- Asymmetric information between courier and client

**Recommendation:**

1. Update server load to include service type and pricing visibility:
```typescript
// src/routes/client/services/[id]/+page.server.ts
const { data: service } = await supabase
    .from('services')
    .select('*, service_types(id, name, price)')  // Add service_types join
    .eq('id', params.id)
    .single();

// Also fetch show_price_to_client setting
const { data: courierProfile } = await supabase
    .from('profiles')
    .select('show_price_to_client')
    .eq('role', 'courier')
    .limit(1)
    .single();

return {
    service,
    showPriceToClient: courierProfile?.show_price_to_client ?? true
};
```

2. Add simplified pricing card to client view:
```svelte
<!-- After Scheduling Info card -->
{#if data.showPriceToClient && (service.service_types || service.calculated_price)}
    <Card.Root>
        <Card.Header>
            <Card.Title class="flex items-center gap-2">
                <Euro class="size-5" />
                {m.pricing_info()}
            </Card.Title>
        </Card.Header>
        <Card.Content class="space-y-2">
            {#if service.service_types?.name}
                <div class="flex justify-between">
                    <span class="text-muted-foreground">{m.service_type()}</span>
                    <span class="font-medium">{service.service_types.name}</span>
                </div>
            {/if}
            {#if service.is_out_of_zone !== null}
                <div class="flex justify-between">
                    <span class="text-muted-foreground">{m.zone_status()}</span>
                    <Badge variant="secondary" class={service.is_out_of_zone
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-green-100 text-green-800'}>
                        {service.is_out_of_zone ? m.out_of_zone() : m.in_zone()}
                    </Badge>
                </div>
            {/if}
            {#if service.calculated_price !== null}
                <Separator />
                <div class="flex justify-between font-medium">
                    <span>{m.total_price()}</span>
                    <span class="text-lg">€{service.calculated_price.toFixed(2)}</span>
                </div>
            {/if}
        </Card.Content>
    </Card.Root>
{/if}
```

---

### [MEDIUM] M2: Hidden fields sent regardless of pricing mode in edit form

**Severity:** MEDIUM
**Status:** OPEN

**Location:**
- `src/routes/courier/services/[id]/edit/+page.svelte:387-391`

**Issue:**
Type-based pricing hidden fields are always submitted, not wrapped in a conditional:

```svelte
<!-- Line 387-391 - ALWAYS sent -->
<input type="hidden" name="service_type_id" value={serviceTypeId} />
<input type="hidden" name="is_out_of_zone" value={isOutOfZone ?? ''} />
<input type="hidden" name="tolls" value={tolls} />
<input type="hidden" name="detected_municipality" value={detectedMunicipality ?? ''} />
<input type="hidden" name="has_time_preference" value={hasTimePreference} />
```

Compare to the new service form which conditionally sends these:
```svelte
<!-- src/routes/courier/services/new/+page.svelte:442-446 -->
{#if isTypePricingMode}
    <input type="hidden" name="has_time_preference" value={hasTimePreference} />
    <input type="hidden" name="is_out_of_zone" value={isOutOfZone ?? false} />
    <input type="hidden" name="detected_municipality" value={detectedMunicipality ?? ''} />
{/if}
```

**Impact:**
- If a service was created in type mode, then courier switches to distance mode and edits the service
- The type fields may get cleared or set to empty/false values
- Could corrupt existing service data

**Recommendation:**
Wrap hidden fields in conditional:
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

Also update server action to not overwrite type fields when not in type mode:
```typescript
// src/routes/courier/services/[id]/edit/+page.server.ts
const updateData: Record<string, unknown> = {
    client_id,
    pickup_location,
    // ... common fields
};

// Only include type-based fields if in type mode
if (courierSettings.pricingMode === 'type') {
    updateData.service_type_id = service_type_id || null;
    updateData.has_time_preference = has_time_preference;
    updateData.is_out_of_zone = is_out_of_zone;
    updateData.detected_municipality = detected_municipality;
    updateData.tolls = tolls;
}

const { error: updateError } = await supabase
    .from('services')
    .update(updateData)
    .eq('id', params.id);
```

---

### ~~[MEDIUM] M3: Missing i18n key `form_select_service_type`~~ - FALSE POSITIVE

**Status:** CLOSED (not an issue)

The key `form_select_service_type` exists in both message files at line 44:
- `messages/en.json:44: "form_select_service_type": "Select a service type"`
- `messages/pt-PT.json:44: "form_select_service_type": "Selecionar tipo de serviço"`

---

### [LOW] L1: Out-of-zone price calculation requires distance but doesn't fail gracefully

**Severity:** LOW
**Status:** OPEN

**Location:**
- `src/lib/services/type-pricing.ts:207-217`

**Issue:**
When calculating out-of-zone pricing, if distance is null, the function returns an error:

```typescript
// Line 207-217
if (input.isOutOfZone) {
    // For out-of-zone, we need distance
    if (input.distanceKm === null || input.distanceKm === undefined) {
        return {
            success: false,
            price: null,
            breakdown: null,
            error: 'Distance required for out-of-zone pricing'
        };
    }
    // ...
}
```

But callers don't handle this gracefully - services are created with `null` price anyway.

**Impact:**
- Services marked as out-of-zone but without GPS coordinates get created with no price
- No user feedback about why price couldn't be calculated

**Recommendation:**
Option A - Calculate with distance=0 (base price only):
```typescript
if (input.isOutOfZone) {
    const base = settings.outOfZoneBase;
    const distance = (input.distanceKm ?? 0) * settings.outOfZonePerKm;  // 0 if no distance
    const tolls = input.tolls ?? 0;
    // ... continue calculation
}
```

Option B - Add warning to service creation response:
```typescript
// In +page.server.ts
if (!typeResult.success) {
    warning = typeResult.error;  // Pass error as warning
}
// Service still created, but with warning displayed
```

---

### [LOW] L2: Client new form uses hardcoded basePrice=0 for surcharge calculation

**Severity:** LOW
**Status:** OPEN

**Location:**
- `src/routes/client/new/+page.svelte:273`

**Issue:**
The TimePreferencePicker is called with `basePrice={0}`:
```svelte
<TimePreferencePicker
    ...
    showPriceWarning={true}
    basePrice={0}  <!-- Should use client's service type price -->
    timePreferencePrice={data.typePricingSettings.timeSpecificPrice}
/>
```

**Impact:**
- Surcharge calculation is incorrect
- Shows full €13 as "surcharge" instead of actual difference (€13 - €4 = €9)

**Recommendation:**
Use the client's default service type price if available:
```svelte
<TimePreferencePicker
    ...
    showPriceWarning={true}
    basePrice={data.clientServiceType?.price ?? 0}
    timePreferencePrice={data.typePricingSettings.timeSpecificPrice}
/>
```

---

## Design Doc Verification Checklist

### From `2025-01-29-pricing-model-redesign.md` Testing Checklist:

| Test Item | Status | Notes |
|-----------|--------|-------|
| Pricing mode switch works (distance ↔ type) | ✅ PASS | |
| Service types CRUD works | ✅ PASS | |
| Distribution zones selection works | ✅ PASS | |
| Zone auto-detection from Mapbox works | ✅ PASS | |
| Zone indicator shows correctly | ✅ PASS | |
| Time preference triggers €13 price | ✅ PASS | |
| Out-of-zone calculates correctly (base + km + tolls) | ✅ PASS | |
| Client default type is pre-filled in service form | ⚠️ PARTIAL | Fails if no default assigned (C1) |
| Tolls input appears only when out-of-zone | ✅ PASS | |
| Price visibility respects settings | ⚠️ PARTIAL | Edit form missing check (H1) |
| Urgency fees hidden when type-based mode | ✅ PASS | |
| Client form shows simplified version | ✅ PASS | |
| Service details view shows type-based pricing info | ⚠️ PARTIAL | Courier yes, client no (M1) |
| Existing services unaffected by mode switch | ⚠️ PARTIAL | Edit form may clear fields (M2) |
| All new strings translated (PT + EN) | ⚠️ PARTIAL | Missing form_select_service_type (M3) |

### Feature Parity (Courier vs Client):

| Feature | Courier | Client | Status |
|---------|---------|--------|--------|
| Service type selection | ✅ Dropdown | ❌ Hidden (uses default) | **Intentional** |
| Zone indicator badge | ✅ Yes | ✅ Yes | OK |
| Manual zone override | ✅ Yes | ✅ Yes | OK |
| Tolls input | ✅ Yes (out-of-zone) | ❌ No | **Intentional** |
| Time preference picker | ✅ Yes | ✅ Yes | OK |
| Price preview on form | ✅ TypePricePreview | ✅ Simplified | OK |
| Price breakdown in details | ✅ Yes | ❌ No | **GAP (M1)** |
| Service type in details | ✅ Yes | ❌ No | **GAP (M1)** |

---

## Files Reference

### Components Created/Modified for Type-Based Pricing:

| File | Purpose |
|------|---------|
| `src/lib/components/ZoneOverrideToggle.svelte` | Manual zone selection when detection fails |
| `src/lib/components/TypePricePreview.svelte` | Live price breakdown preview |
| `src/lib/components/TimePreferencePicker.svelte` | Date/time with price warning |
| `src/lib/services/type-pricing.ts` | Price calculation logic |
| `src/lib/services/municipality.ts` | Municipality extraction from address |
| `src/lib/data/portugal-municipalities.ts` | 308 municipalities dataset |

### Routes Modified:

| Route | Changes |
|-------|---------|
| `src/routes/courier/services/new/+page.svelte` | Service type selector, zone indicator, tolls, price preview |
| `src/routes/courier/services/new/+page.server.ts` | Type-based price calculation |
| `src/routes/courier/services/[id]/+page.svelte` | Price breakdown display |
| `src/routes/courier/services/[id]/edit/+page.svelte` | Type-based pricing fields |
| `src/routes/courier/services/[id]/edit/+page.server.ts` | Type-based price recalculation |
| `src/routes/courier/clients/new/+page.svelte` | Default service type selector |
| `src/routes/courier/clients/new/+page.server.ts` | Save default service type |
| `src/routes/client/new/+page.svelte` | Zone indicator, time preference picker |
| `src/routes/client/new/+page.ts` | Load pricing mode, settings, client service type |
| `src/routes/client/new/+page.server.ts` | Type-based price calculation for client |
| `src/routes/client/services/[id]/+page.svelte` | (Missing pricing display - M1) |

### i18n Keys Added:

```json
// Pricing
"price_estimate": "Estimated price / Preço estimado",
"price_final_note": "Final price confirmed by courier / Preço final confirmado pelo estafeta",
"price_breakdown": "Price Breakdown / Discriminação do Preço",
"base_price": "Base price / Preço base",
"distance_charge": "Distance charge / Custo de distância",
"total_price": "Total / Total",

// Zone
"zone_override_title": "Zone Override / Substituição de Zona",
"zone_detection_failed": "Could not determine municipality / Não foi possível determinar o concelho",
"zone_manual_select": "Select manually / Selecionar manualmente",
"mark_in_zone": "Mark as in-zone / Marcar como dentro da zona",
"mark_out_of_zone": "Mark as out-of-zone / Marcar como fora da zona",

// Time preference
"time_preference_surcharge": "+€{amount} for time preference / +€{amount} pela preferência de horário"
```

### Missing i18n Keys:

```json
"form_select_service_type": "Select service type / Selecione o tipo de serviço"
```

---

## Fix Priority

| Priority | ID | Issue | Effort |
|----------|-----|-------|--------|
| 1 | C1 | Client request fails without default service type | Medium |
| 2 | H1 | Edit form doesn't respect price visibility | Low |
| 3 | H2 | Time preference shows total not surcharge | Low |
| 4 | M1 | Client details missing pricing info | Medium |
| 5 | M2 | Hidden fields sent in wrong mode | Low |
| 6 | M3 | Missing i18n key | Trivial |
| 7 | L1 | Out-of-zone graceful fallback | Low |
| 8 | L2 | Client form basePrice=0 | Trivial |

---

## Next Steps

1. Create implementation plan for fixes (similar to `2025-01-29-pricing-audit-fixes.md`)
2. Prioritize C1 as it can cause silent failures
3. Group low-effort fixes (H1, H2, M2, M3, L2) into single commit
4. M1 requires more design consideration - may need design review
5. Run E2E tests after fixes to verify all scenarios

---

## Appendix: Key Code References

### Type-Based Price Calculation (type-pricing.ts:185-285)

```typescript
export async function calculateTypedPrice(
    supabase: SupabaseClient,
    input: TypePricingInput
): Promise<TypePriceResult> {
    // Priority 1: Out-of-zone = base + km + tolls
    if (input.isOutOfZone) {
        // ...
    }

    // Priority 2: Time preference = fixed price
    if (input.hasTimePreference && settings.timeSpecificPrice > 0) {
        // ...
    }

    // Priority 3: Normal = service type price
    return {
        success: true,
        price: serviceType.price,
        breakdown: { ... }
    };
}
```

### Pricing Rules (from design doc):

| Scenario | Price Calculation |
|----------|-------------------|
| Normal in-zone | Base type price (Dental €4, Optical €3) |
| Any time preference | **€13 flat** (replaces base type) |
| Out-of-zone | **€13 + €0.50/km + tolls** |
| Out-of-zone + time | Same as out-of-zone (no double €13) |

---

*Document created for future reference. All findings verified against actual code as of 2025-01-29.*
