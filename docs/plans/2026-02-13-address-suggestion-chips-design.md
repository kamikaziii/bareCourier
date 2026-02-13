# Address Suggestion Chips Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the auto-fill pickup address behavior with tappable address suggestion chips below both pickup and delivery inputs, giving repeat clients quick access to their most-used addresses.

**Architecture:** Add an `AddressSuggestion` type, fetch the client's past service addresses in the existing `+page.ts` load function, pass them as a new `suggestions` prop to `AddressInput.svelte`, and render them as `Badge` chips. Remove the auto-fill of the default pickup address so the field starts empty — the default becomes the first chip instead.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, shadcn-svelte Badge, Tailwind CSS v4, Paraglide i18n

---

### Task 1: Add `AddressSuggestion` type

**Files:**
- Create: `src/lib/types/address-suggestion.ts`

**Step 1: Create the type file**

```typescript
export type AddressSuggestion = {
  label: string;              // Truncated display text (~30 chars)
  address: string;            // Full address string
  coords: [number, number] | null; // [lng, lat] if available
  isDefault?: boolean;        // Shows home icon on chip
};
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm run check`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/lib/types/address-suggestion.ts
git commit -m "feat: add AddressSuggestion type for address chips"
```

---

### Task 2: Add i18n messages

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English messages**

Add these entries to `messages/en.json` (near the existing `address_hint_*` keys):

```json
"address_chip_default": "Default",
```

**Step 2: Add Portuguese messages**

Add these entries to `messages/pt-PT.json`:

```json
"address_chip_default": "Predefinido",
```

**Step 3: Regenerate paraglide messages**

Run: `pnpm run check`
Expected: Paraglide regenerates `src/lib/paraglide/messages.js` with the new keys. No errors.

**Step 4: Commit**

```bash
git add messages/en.json messages/pt-PT.json src/lib/paraglide/
git commit -m "feat: add i18n messages for address suggestion chips"
```

---

### Task 3: Fetch address suggestions in `+page.ts`

**Files:**
- Modify: `src/routes/client/new/+page.ts` (add suggestion-building logic to `load`)

This task queries the client's past services and builds two arrays: `pickupSuggestions` and `deliverySuggestions`.

**Step 1: Add the import and helper function**

At the top of `+page.ts`, add the import for the type:

```typescript
import type { AddressSuggestion } from '$lib/types/address-suggestion.js';
```

Add a helper function before the `load` export:

```typescript
function truncateLabel(address: string, maxLength = 30): string {
  return address.length > maxLength ? address.slice(0, maxLength) + '…' : address;
}

function buildSuggestions(
  rows: { location: string; lat: number | null; lng: number | null; count: number }[],
  defaultAddress?: { address: string; coords: [number, number] | null } | null
): AddressSuggestion[] {
  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];

  // Default address first (if provided)
  if (defaultAddress?.address) {
    seen.add(defaultAddress.address);
    suggestions.push({
      label: truncateLabel(defaultAddress.address),
      address: defaultAddress.address,
      coords: defaultAddress.coords,
      isDefault: true
    });
  }

  // Then by frequency (rows are pre-sorted by count DESC, then recency DESC)
  for (const row of rows) {
    if (seen.has(row.location)) continue;
    if (suggestions.length >= 3) break;
    seen.add(row.location);
    suggestions.push({
      label: truncateLabel(row.location),
      address: row.location,
      coords: row.lat != null && row.lng != null ? [row.lng, row.lat] : null
    });
  }

  return suggestions;
}
```

**Step 2: Add the data fetching inside `load`**

After the existing `clientServiceType` logic and before the `return` statement, add:

```typescript
// Fetch client's past service addresses for suggestion chips
let pickupSuggestions: AddressSuggestion[] = [];
let deliverySuggestions: AddressSuggestion[] = [];

if (profile?.id) {
  // Query distinct pickup locations with frequency count
  // Using raw SQL via rpc would be ideal, but we can aggregate client-side
  // since a solo courier's client won't have thousands of services
  const { data: pastServices } = await supabase
    .from('services')
    .select('pickup_location, pickup_lat, pickup_lng, delivery_location, delivery_lat, delivery_lng')
    .eq('client_id', profile.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (pastServices && pastServices.length > 0) {
    // Build pickup frequency map
    const pickupMap = new Map<string, { lat: number | null; lng: number | null; count: number; lastIndex: number }>();
    pastServices.forEach((s, i) => {
      if (!s.pickup_location) return;
      const existing = pickupMap.get(s.pickup_location);
      if (existing) {
        existing.count++;
      } else {
        pickupMap.set(s.pickup_location, { lat: s.pickup_lat, lng: s.pickup_lng, count: 1, lastIndex: i });
      }
    });

    const pickupRows = [...pickupMap.entries()]
      .map(([location, data]) => ({ location, ...data }))
      .sort((a, b) => b.count - a.count || a.lastIndex - b.lastIndex);

    // Build delivery frequency map
    const deliveryMap = new Map<string, { lat: number | null; lng: number | null; count: number; lastIndex: number }>();
    pastServices.forEach((s, i) => {
      if (!s.delivery_location) return;
      const existing = deliveryMap.get(s.delivery_location);
      if (existing) {
        existing.count++;
      } else {
        deliveryMap.set(s.delivery_location, { lat: s.delivery_lat, lng: s.delivery_lng, count: 1, lastIndex: i });
      }
    });

    const deliveryRows = [...deliveryMap.entries()]
      .map(([location, data]) => ({ location, ...data }))
      .sort((a, b) => b.count - a.count || a.lastIndex - b.lastIndex);

    // Build suggestions
    const defaultPickupAddress = profile.default_pickup_location
      ? {
          address: profile.default_pickup_location,
          coords: (profile.default_pickup_lng != null && profile.default_pickup_lat != null
            ? [profile.default_pickup_lng, profile.default_pickup_lat]
            : null) as [number, number] | null
        }
      : null;

    pickupSuggestions = buildSuggestions(pickupRows, defaultPickupAddress);
    deliverySuggestions = buildSuggestions(deliveryRows);
  } else if (profile.default_pickup_location) {
    // No past services but has default address — show it as a chip
    pickupSuggestions = [{
      label: truncateLabel(profile.default_pickup_location),
      address: profile.default_pickup_location,
      coords: (profile.default_pickup_lng != null && profile.default_pickup_lat != null
        ? [profile.default_pickup_lng, profile.default_pickup_lat]
        : null) as [number, number] | null,
      isDefault: true
    }];
  }
}
```

**Step 3: Add suggestions to the return object**

Update the return statement to include the new arrays:

```typescript
return {
  pricingMode,
  typePricingSettings,
  showPriceToClient,
  clientServiceType,
  pickupSuggestions,
  deliverySuggestions
};
```

**Step 4: Verify TypeScript compiles**

Run: `pnpm run check`
Expected: No errors. The `PageData` type auto-infers the new fields.

**Step 5: Commit**

```bash
git add src/routes/client/new/+page.ts
git commit -m "feat: fetch address suggestions from client's service history"
```

---

### Task 4: Enhance `AddressInput.svelte` with chip support

**Files:**
- Modify: `src/lib/components/AddressInput.svelte`

**Step 1: Add the new prop and imports**

Update the `Props` interface and destructuring to add `suggestions`:

```typescript
import type { AddressSuggestion } from "$lib/types/address-suggestion.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Home } from "@lucide/svelte";
```

Update the `Props` interface:

```typescript
interface Props {
  value: string;
  onSelect: (address: string, coords: [number, number] | null) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  showHint?: boolean;
  suggestions?: AddressSuggestion[];
}
```

Add `suggestions` to the destructured props:

```typescript
let {
  value = $bindable(""),
  onSelect,
  placeholder,
  disabled = false,
  id,
  showHint = true,
  suggestions: addressSuggestions = [],
}: Props = $props();
```

Note: we rename `suggestions` to `addressSuggestions` locally because the component already has a `suggestions` variable for Mapbox geocoding results.

**Step 2: Add chip selection state and handler**

After the existing state variables, add:

```typescript
let selectedChipIndex = $state<number | null>(null);
```

Add the chip handler function (after `handleKeydown`):

```typescript
function handleChipSelect(suggestion: AddressSuggestion, index: number) {
  value = suggestion.address;
  selectedChipIndex = index;
  onSelect(suggestion.address, suggestion.coords);
  // Close any open Mapbox suggestions
  showSuggestions = false;
  suggestions = [];
  addressState = suggestion.coords ? "verified" : "custom";
}
```

**Step 3: Clear chip highlight on manual input**

Update `handleInput` to clear the chip highlight at the top of the function:

```typescript
function handleInput() {
  selectedChipIndex = null;  // ← Add this line
  addressState = value.length > 0 ? "typing" : "idle";
  // ... rest unchanged
}
```

**Step 4: Render the chips in the template**

After the closing `</div>` of the `relative` div (line 172) and before the `{#if showHint}` block (line 174), add:

```svelte
{#if addressSuggestions.length > 0}
  <div class="flex flex-wrap gap-1.5">
    {#each addressSuggestions as suggestion, i}
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors
          {selectedChipIndex === i
            ? 'bg-primary text-primary-foreground border-transparent'
            : 'bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground'}"
        onclick={() => handleChipSelect(suggestion, i)}
        disabled={disabled}
      >
        {#if suggestion.isDefault}
          <Home class="size-3" />
        {/if}
        {suggestion.label}
      </button>
    {/each}
  </div>
{/if}
```

Note: We use a plain `<button>` styled like Badge instead of the `Badge` component because `Badge` renders a `<span>` (or `<a>` with href) and doesn't support `onclick`/`disabled` props natively. A semantic `<button>` is better for accessibility.

**Step 5: Verify TypeScript compiles and lint passes**

Run: `pnpm run check && pnpm run lint`
Expected: No errors

**Step 6: Commit**

```bash
git add src/lib/components/AddressInput.svelte
git commit -m "feat: add address suggestion chips to AddressInput component"
```

---

### Task 5: Update `+page.svelte` to use chips and remove auto-fill

**Files:**
- Modify: `src/routes/client/new/+page.svelte`

**Step 1: Remove the default address auto-fill**

Change lines 33–50 from:

```typescript
const defaultPickup = data.profile?.default_pickup_location || "";
// svelte-ignore state_referenced_locally
const defaultPickupCoordsFromProfile: [number, number] | null =
  data.profile?.default_pickup_lng && data.profile?.default_pickup_lat
    ? [data.profile.default_pickup_lng, data.profile.default_pickup_lat]
    : null;
let pickupLocation = $state(defaultPickup);
```

To:

```typescript
let pickupLocation = $state("");
```

Also change `pickupCoords` initialization from:

```typescript
let pickupCoords = $state<[number, number] | null>(
  defaultPickupCoordsFromProfile,
);
```

To:

```typescript
let pickupCoords = $state<[number, number] | null>(null);
```

**Step 2: Remove the initial zone detection `$effect`**

Delete the entire block (lines 108–120):

```typescript
// Detect pickup zone for pre-filled default address on mount
let hasDetectedInitialPickupZone = false;
$effect(() => {
  if (
    !hasDetectedInitialPickupZone &&
    isTypePricingMode &&
    defaultPickup &&
    defaultPickupCoordsFromProfile
  ) {
    hasDetectedInitialPickupZone = true;
    pickupAddressSelected = true;
    detectPickupZone(defaultPickup, defaultPickupCoordsFromProfile);
  }
});
```

This is no longer needed because zone detection now triggers via `handlePickupSelect` when a chip is tapped.

**Step 3: Pass `suggestions` to the pickup AddressInput**

Change the pickup `AddressInput` (around line 252):

```svelte
<AddressInput
  id="pickup"
  bind:value={pickupLocation}
  onSelect={handlePickupSelect}
  placeholder={m.form_pickup_placeholder()}
  disabled={loading}
  suggestions={data.pickupSuggestions}
/>
```

**Step 4: Pass `suggestions` to the delivery AddressInput**

Change the delivery `AddressInput` (around line 327):

```svelte
<AddressInput
  id="delivery"
  bind:value={deliveryLocation}
  onSelect={handleDeliverySelect}
  placeholder={m.form_delivery_placeholder()}
  disabled={loading}
  suggestions={data.deliverySuggestions}
/>
```

**Step 5: Clean up unused references**

Remove the now-unused constants `defaultPickup` and `defaultPickupCoordsFromProfile`, and the variable `hasDetectedInitialPickupZone`. These were all used only for the auto-fill + initial zone detection behavior that has been replaced by chips.

**Step 6: Verify TypeScript compiles and lint passes**

Run: `pnpm run check && pnpm run lint`
Expected: No errors

**Step 7: Commit**

```bash
git add src/routes/client/new/+page.svelte
git commit -m "feat: replace address auto-fill with suggestion chips on new service page"
```

---

### Task 6: Visual and functional verification

**Files:** (no changes — testing only)

**Step 1: Start dev server**

Run: `pnpm run dev`

**Step 2: Test as a client with past services**

1. Log in as `test@example.com` / `6Ee281414`
2. Navigate to the New Service page
3. Verify: Pickup field is **empty** (no auto-fill)
4. Verify: Chips appear below the pickup field — default address first (with home icon), then past frequent addresses
5. Verify: Delivery chips appear (past delivery addresses)
6. Tap a pickup chip → field fills, green verification animation plays (if coords), zone detection triggers in type mode
7. Tap a different chip → field changes, chip highlight switches
8. Type manually → chip highlight clears
9. Clear the field → chip highlight clears, no coords
10. Submit a service → works correctly with chip-selected addresses

**Step 3: Test as a new client with no past services**

1. If no past services exist for the client, only the default address chip should show for pickup (if profile has one)
2. No delivery chips should appear
3. If no default address either, no chips at all — identical to current behavior

**Step 4: Test with no Mapbox token**

1. Temporarily unset `PUBLIC_MAPBOX_TOKEN` in `.env`
2. The plain `<Input>` fallback renders — chips should NOT appear (the AddressInput is only used when `hasMapbox` is true, and the plain Input doesn't have a `suggestions` prop)
3. Restore the token

**Step 5: Run E2E tests to check nothing broke**

Run: `pnpm exec playwright test e2e/00-reset.spec.ts e2e/01-courier-onboarding.spec.ts e2e/02-first-client-creation.spec.ts e2e/03-courier-creates-service.spec.ts e2e/04-client-first-request.spec.ts e2e/05-request-acceptance.spec.ts`
Expected: All passing. The E2E tests type addresses manually, so chips are irrelevant to them.

---

## Summary of all changes

| File | Change |
|------|--------|
| `src/lib/types/address-suggestion.ts` | **NEW** — `AddressSuggestion` type |
| `messages/en.json` | Add `address_chip_default` |
| `messages/pt-PT.json` | Add `address_chip_default` |
| `src/routes/client/new/+page.ts` | Add past-service query + `buildSuggestions` helper, return `pickupSuggestions` & `deliverySuggestions` |
| `src/lib/components/AddressInput.svelte` | Add optional `suggestions` prop, chip rendering, chip selection state, highlight management |
| `src/routes/client/new/+page.svelte` | Remove auto-fill, remove initial zone `$effect`, pass `suggestions` to both inputs |
