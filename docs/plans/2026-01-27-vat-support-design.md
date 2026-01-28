# VAT Support Design

**Date:** 2026-01-27
**Status:** Approved

## Context

The courier is VAT-registered and needs to show prices with VAT in billing and reports. Currently, the pricing system stores raw net prices with no tax support.

## Design Decisions

| Decision | Choice |
|----------|--------|
| VAT status | VAT-registered (single courier) |
| VAT rate | Single rate, courier-defined (e.g., 23%) |
| Price basis | Courier chooses: net (VAT-exclusive) or gross (VAT-inclusive) |
| VAT display | Billing pages and reports/CSV only — not on service cards or dashboards |
| CSV/reports | Three columns: Net, VAT amount, Gross |
| Storage | `calculated_price` remains as-is; VAT computed at display/export time |

## Implementation

### 1. Database: Courier VAT Settings

Add columns to `profiles` (courier row only):

```sql
vat_enabled boolean DEFAULT false,
vat_rate numeric DEFAULT 0,          -- e.g., 23 for 23%
prices_include_vat boolean DEFAULT false  -- true = gross, false = net
```

- `vat_enabled`: Whether VAT applies at all
- `vat_rate`: The VAT percentage
- `prices_include_vat`: Whether the courier's configured prices already include VAT
  - `false` (net): calculated_price is net → VAT added on top → gross = net × (1 + rate/100)
  - `true` (gross): calculated_price is gross → net = gross / (1 + rate/100) → VAT = gross - net

### 2. Settings UI: VAT Section in Pricing Tab

Add a "VAT" card to `PricingTab.svelte`:

- **Toggle**: "I charge VAT" (enables/disables the section)
- **Input**: VAT rate (%) — number input, e.g., 23
- **Toggle**: "My prices already include VAT" (net vs gross)

### 3. VAT Calculation Helper

New utility in `src/lib/services/pricing.ts`:

```typescript
interface VatBreakdown {
  net: number;
  vat: number;
  gross: number;
  rate: number;
}

function calculateVat(price: number, vatRate: number, priceIncludesVat: boolean): VatBreakdown
```

This is a pure function — no DB access. Called at display/export time.

### 4. Billing Pages

Update billing views (`/courier/billing/`) to show:
- Net subtotal
- VAT amount
- Gross total

Only when `vat_enabled` is true for the courier.

### 5. Reports & CSV Export

Update `/courier/reports/` to:
- Add Net, VAT, Gross columns to CSV
- Show VAT summary in report totals

### 6. What Does NOT Change

- Service cards, dashboards, and day-to-day views — no VAT shown
- `calculated_price` storage — remains the price as configured (net or gross depending on setting)
- `price_breakdown` JSONB — no VAT fields added
- Client-facing views — no VAT display (billing is courier-side only)
