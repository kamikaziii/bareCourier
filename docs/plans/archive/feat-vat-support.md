# feat: VAT Support for Pricing System

**Type:** Enhancement
**Design doc:** `docs/plans/2026-01-27-vat-support-design.md`
**Status:** Reviewed

## Overview

Add VAT support so the courier can display prices with VAT breakdown in billing pages and CSV exports. VAT is configured once in settings (rate + net/gross toggle) and computed at display/export time. Each service snapshots the VAT rate at creation for historical accuracy.

## Proposed Solution

### Database Changes

**Migration 1: `add_vat_settings_to_profiles`**

Add to `profiles` table (courier settings):
```sql
ALTER TABLE profiles ADD COLUMN vat_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN vat_rate numeric(5,2) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN prices_include_vat boolean DEFAULT false;

-- Enforce valid VAT rate range
ALTER TABLE profiles ADD CONSTRAINT chk_vat_rate_range
  CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));

-- Require a rate when VAT is enabled
ALTER TABLE profiles ADD CONSTRAINT chk_vat_rate_when_enabled
  CHECK (vat_enabled = false OR vat_rate IS NOT NULL);
```

**Migration 2: `add_vat_snapshot_to_services`**

Add to `services` table (per-service snapshot):
```sql
ALTER TABLE services ADD COLUMN vat_rate_snapshot numeric(5,2);
ALTER TABLE services ADD COLUMN prices_include_vat_snapshot boolean;

ALTER TABLE services ADD CONSTRAINT chk_vat_rate_snapshot_range
  CHECK (vat_rate_snapshot IS NULL OR (vat_rate_snapshot >= 0 AND vat_rate_snapshot <= 100));
```

**Migration 3: `backfill_vat_snapshots`**

Backfill existing services so no NULL fallback is needed:
```sql
UPDATE services
SET vat_rate_snapshot = 0,
    prices_include_vat_snapshot = false
WHERE vat_rate_snapshot IS NULL;

ALTER TABLE services ALTER COLUMN vat_rate_snapshot SET DEFAULT 0;
ALTER TABLE services ALTER COLUMN vat_rate_snapshot SET NOT NULL;
ALTER TABLE services ALTER COLUMN prices_include_vat_snapshot SET DEFAULT false;
ALTER TABLE services ALTER COLUMN prices_include_vat_snapshot SET NOT NULL;
```

This eliminates the fallback path — all services always have explicit VAT snapshot values.

### Courier Layout: Forward VAT Settings

Update `src/routes/courier/+layout.server.ts` to include `vat_enabled`, `vat_rate`, `prices_include_vat` in the profile data returned to child routes. The layout already loads the full profile — just forward the three new fields. No extra query needed.

### VAT Calculation Utility

New `calculateVat()` function in `src/lib/services/pricing.ts`:

```typescript
export interface VatBreakdown {
  net: number;
  vat: number;
  gross: number;
  rate: number;
}

export function calculateVat(
  price: number,
  vatRate: number,
  priceIncludesVat: boolean
): VatBreakdown
```

- Store rate as integer percentage (23), convert to decimal at calc time
- Round per line item to 2 decimals
- When `priceIncludesVat`: net = round(price / (1 + rate/100)), vat = round(price - net)
- When not: vat = round(price * rate/100), gross = round(price + vat)
- If rate <= 0: return { net: price, vat: 0, gross: price, rate: 0 }

### Settings UI

Add a "VAT" card to `PricingTab.svelte` (inside existing `?/updatePricingPreferences` form):

- Toggle: "I charge VAT" (`vat_enabled`)
- Number input: VAT rate % (0–100, step 0.01) — shown only when enabled
- Toggle: "My prices already include VAT" (`prices_include_vat`) — shown only when enabled

### Billing Pages

Update `/courier/billing/[client_id]/+page.svelte`:

- When `vat_enabled`: show Net, VAT, Gross columns in service table + summary cards
- When `vat_enabled` is false: hide VAT columns entirely (current behavior)
- CSV export: add Net, VAT, Gross columns (only when `vat_enabled`)
- Use snapshot values from each service (always present after backfill migration)
- Compute VAT totals in the existing totaling loop (single pass, not a second iteration)

### Reports / Insights (Phase 2 — deferred)

Update `/courier/insights/` and `insights-data.ts` in a follow-up to reduce initial scope:

- Add VAT breakdown to revenue totals when `vat_enabled`
- CSV export: add Net, VAT, Gross columns when `vat_enabled`

### Service Creation

Update `calculateAndSaveServicePrice()` in `pricing.ts`:

- After calculating price, snapshot `vat_rate` and `prices_include_vat` from courier profile onto the service record

### What Does NOT Change

- Service cards, dashboards, day-to-day views — no VAT shown
- `calculated_price` field — remains the raw price as configured
- `price_breakdown` JSONB — no VAT fields added
- Client-facing views — no VAT display

## Technical Considerations

- **Rounding:** Calculate VAT per service, then sum. Accept possible ±€0.01 discrepancy vs total-based calc.
- **Validation:** VAT rate 0–100, precision 2 decimals. `numeric(5,2)` in DB with CHECK constraints.
- **Historical accuracy:** Snapshot columns ensure past services retain their original VAT rate. Backfill migration sets all pre-existing services to rate=0 (no VAT).
- **No fallback needed:** After backfill, all services have explicit snapshot values.
- **Default NULL:** `vat_rate` defaults to NULL (not 0) to distinguish "not configured" from "zero percent."

## Acceptance Criteria

- [ ] Courier can enable/disable VAT in Settings → Pricing tab
- [ ] Courier can set a custom VAT rate (e.g., 23%)
- [ ] Courier can toggle between net and gross pricing
- [ ] Billing page shows Net/VAT/Gross columns when VAT enabled
- [ ] Billing page hides VAT columns when VAT disabled
- [ ] Billing CSV export includes Net/VAT/Gross columns when VAT enabled
- [ ] New services snapshot VAT rate at creation time
- [ ] Pre-existing services have snapshot = 0 (no retroactive VAT)
- [ ] VAT rate validated 0–100 with 2 decimal precision (DB constraints + UI)
- [ ] Enabling VAT without setting a rate is prevented (DB constraint)
- [ ] `calculateVat()` correctly handles both net and gross input prices
- [ ] Zero VAT rate returns price unchanged (no division by zero)

## Implementation Order

1. **Migration 1:** Profile VAT settings columns + constraints
2. **Migration 2:** Service snapshot columns + constraint
3. **Migration 3:** Backfill + NOT NULL enforcement
4. **Types:** Update `database.types.ts` with new fields
5. **Layout:** Forward VAT fields in courier layout
6. **Utility:** Add `calculateVat()` to `pricing.ts`
7. **Settings UI:** VAT card in `PricingTab.svelte` + server action
8. **Service creation:** Snapshot VAT settings on new services
9. **Billing pages:** Conditional VAT columns + CSV export

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/XXX_add_vat_settings.sql` | New — profile columns + constraints |
| `supabase/migrations/XXX_add_vat_snapshot.sql` | New — service snapshot columns + constraint |
| `supabase/migrations/XXX_backfill_vat_snapshots.sql` | New — backfill + NOT NULL |
| `src/lib/database.types.ts` | Add VAT fields to Profile, Service types |
| `src/routes/courier/+layout.server.ts` | Forward VAT fields to child routes |
| `src/lib/services/pricing.ts` | Add `calculateVat()`, update `CourierPricingSettings`, snapshot on service creation |
| `src/routes/courier/settings/PricingTab.svelte` | VAT settings card |
| `src/routes/courier/settings/+page.server.ts` | Parse VAT fields in `updatePricingPreferences` |
| `src/routes/courier/billing/[client_id]/+page.svelte` | VAT columns in table, summary, CSV |

## Review Findings Applied

| Severity | Finding | Resolution |
|----------|---------|------------|
| P1 | NULL fallback causes retroactive VAT on old services | Backfill migration (Migration 3) sets all existing to 0 + NOT NULL |
| P1 | No CHECK constraints allows invalid rates | Added range + cross-column constraints |
| P2 | `vat_rate DEFAULT 0` misleading | Changed to `DEFAULT NULL` |
| P2 | Billing page missing courier VAT settings access | Forward from courier layout (no extra query) |
| P2 | Second loop pass for VAT totals | Compute in existing loop |
| P3 | Reports/insights adds scope | Deferred to Phase 2 |

## Verification

1. Enable VAT at 23% (net) in settings → verify saved to profile
2. Create a new service → verify `vat_rate_snapshot` = 23, `prices_include_vat_snapshot` = false
3. Open billing for a client → verify Net/VAT/Gross columns with correct math
4. Export CSV → verify three new columns present
5. Disable VAT → verify billing shows single Price column, CSV has no VAT columns
6. Change rate to 20% → verify old service still shows 23% (from snapshot), new service shows 20%
7. Toggle to "prices include VAT" → verify net = price / 1.23, not price * 1.23
8. Verify pre-existing services show vat_rate_snapshot = 0 (no VAT applied)
9. Try to enable VAT without setting rate → verify DB constraint prevents it
10. Run `pnpm run check` — no TypeScript errors
