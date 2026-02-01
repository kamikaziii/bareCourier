# Client Billing: Type-Based Pricing Support

**Date:** 2025-02-01
**Status:** Approved
**Author:** Filipe Garrido + Claude

---

## Context

The type-based pricing feature (PR7) was implemented but missed updating the client billing UI. Currently:

- The billing tab on `/courier/clients/[id]` only shows distance-based pricing info
- The billing config page `/courier/billing/[client_id]` only supports distance-based models
- When type-based pricing is active, these pages are confusing/irrelevant

This design addresses the gap.

---

## Decisions

| Aspect | Decision |
|--------|----------|
| Per-client overrides | **None** - Type-based pricing is global, all clients pay the same rates |
| Billing tab content | Show client's default service type with price and link to edit |
| Config page behavior | Redirect to client detail page when type-based pricing is active |
| Services history | Move to billing tab on client detail page |
| Recalculate prices | Support recalculating type-based prices |

---

## Design

### 1. Billing Tab (Type-Based Mode)

When `pricing_mode === 'type'`, the billing tab on `/courier/clients/[id]` shows:

```
┌─────────────────────────────────────────────────────────────┐
│ 💶 Faturação                                                │
├─────────────────────────────────────────────────────────────┤
│ Modo de preços: Baseado em tipo                             │
│                                                             │
│ Tipo de serviço padrão: Dental (€4.00)         [Alterar]   │
│                                                             │
│ ─────────────── Histórico ───────────────                   │
│ [Date picker: Start] [Date picker: End]                     │
│                                                             │
│ [Stats cards: Services | Distance | Revenue]                │
│                                                             │
│ [Services table with status, prices, etc.]                  │
│                                                             │
│ [Recalculate Missing] [Recalculate All] [Export CSV]        │
└─────────────────────────────────────────────────────────────┘
```

- "Alterar" button links to the client edit page
- Services history is loaded client-side with date range filtering
- Stats show totals for the selected date range
- VAT breakdown shown if VAT is enabled

### 2. Billing Tab (Distance-Based Mode)

When `pricing_mode === 'warehouse'` or `'zone'`, the billing tab shows:

- Current pricing model (per_km, flat_plus_km, zone)
- Base fee, per km rate, or zone brackets
- Link to `/courier/billing/[client_id]` for full configuration
- Services history (same as type-based mode)

### 3. Billing Config Page Redirect

When type-based pricing is active, `/courier/billing/[client_id]` redirects:

```typescript
// In +page.server.ts load function
const { data: courier } = await supabase
  .from('profiles')
  .select('pricing_mode')
  .eq('role', 'courier')
  .single();

if (courier?.pricing_mode === 'type') {
  redirect(303, localizeHref(`/courier/clients/${client_id}?tab=billing`));
}
```

The client detail page reads the `tab` query param to auto-select the billing tab.

### 4. Recalculate Logic for Type-Based Pricing

Recalculation uses existing service data:

- `service_type_id` → get price from `service_types` table
- `has_time_preference` → if true, use `time_specific_price`
- `is_out_of_zone` → if true, use `out_of_zone_base + (distance_km × out_of_zone_per_km) + tolls`

```
if is_out_of_zone:
    price = out_of_zone_base + (distance_km × out_of_zone_per_km) + tolls
else if has_time_preference:
    price = time_specific_price
else:
    price = service_type.price
```

Implementation: Add new RPC `bulk_recalculate_type_based_prices` or extend existing RPC to detect mode.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/routes/courier/clients/[id]/+page.server.ts` | Load `pricing_mode`, `service_types`, client's default type. Add `recalculateMissing` and `recalculateAll` actions. |
| `src/routes/courier/clients/[id]/+page.svelte` | Expand billing tab with conditional UI. Add services history, date pickers, stats, table, export. |
| `src/routes/courier/billing/[client_id]/+page.server.ts` | Add redirect when `pricing_mode === 'type'`. |
| `supabase/migrations/xxx_add_type_based_recalculate.sql` | New RPC for type-based price recalculation. |
| `messages/en.json` + `messages/pt-PT.json` | New i18n keys for type-based billing display. |

---

## i18n Keys Needed

```json
// English
"billing_pricing_mode": "Pricing Mode",
"billing_type_based": "Type-based pricing",
"billing_default_service_type": "Default Service Type",
"billing_change": "Change"

// Portuguese
"billing_pricing_mode": "Modo de Preços",
"billing_type_based": "Preços baseados em tipo",
"billing_default_service_type": "Tipo de Serviço Padrão",
"billing_change": "Alterar"
```

---

## Testing Checklist

- [ ] Billing tab shows type-based info when `pricing_mode === 'type'`
- [ ] Billing tab shows distance-based info when `pricing_mode !== 'type'`
- [ ] `/courier/billing/[client_id]` redirects when type-based pricing active
- [ ] Services history loads with date filtering
- [ ] Stats calculate correctly for date range
- [ ] Recalculate Missing works for type-based services
- [ ] Recalculate All works for type-based services
- [ ] CSV export includes type-based pricing data
- [ ] "Change" link navigates to client edit page
- [ ] Tab auto-selects when `?tab=billing` query param present
