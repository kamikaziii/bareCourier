# Service Details Enhancements - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add human-readable service IDs, recipient tracking, customer references, and printable labels.

## Progress Status

| Task | Status | Commit |
|------|--------|--------|
| 1. Database Migration | ✅ Done | `0658fec` |
| 2. Regenerate TypeScript Types | ✅ Done | `8cb26d5` |
| 3. Add i18n Translation Keys | ✅ Done | `b8fd667` |
| 4. Update Service Card | ✅ Done | `103674d` |
| 5. Service Detail - Display ID & Copy | ✅ Done | `9c2e308` |
| 6. Service Detail - Recipient Card | ✅ Done | `745d970` |
| 7. Courier New Service Form | ✅ Done | `4ec91b6` |
| 8. Courier Edit Service Form | ✅ Done | `042d930` |
| 9. Client New Service Form | ✅ Done | `2d48aa7` |
| 10. Label Branding Settings | ✅ Done | `9f8bac1` |
| 11. Install QR Code Library | ✅ Done | `47bd8ce` |
| 12. Create ServiceLabel Component | ✅ Done | `3fc4770` |
| 13. Add Print Label Dialog | ⏳ Pending | - |
| 14. Client Print Label | ⏳ Pending | - |
| 15. Final Testing | ⏳ Pending | - |

**Next:** Start at Task 13 - Add print button and dialog to courier service detail page.

**Architecture:** Database trigger auto-generates `#YY-NNNN` display IDs using counter table pattern. New optional fields for recipient info. Print label component with QR code.

**Tech Stack:** SvelteKit, Supabase (PostgreSQL), Svelte 5 runes, shadcn-svelte, qrcode library

---

## Task 1: Database Migration - Counter Table & Service Columns

**Files:**
- Create: `supabase/migrations/20260129000001_add_service_display_ids.sql`

**Step 1: Create the migration file**

```sql
-- Migration: Add service display IDs, recipient fields, and label branding

-- 1. Create counter table for year-based sequential IDs
CREATE TABLE IF NOT EXISTS service_counters (
  year smallint PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. RLS for counter table (trigger-only access)
ALTER TABLE service_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_counters_no_direct_access"
  ON service_counters FOR ALL
  USING (false);

-- 3. Add new columns to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS display_id text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS customer_reference text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS recipient_phone text;

-- 4. Add new columns to profiles (label branding)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS label_business_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS label_tagline text;

-- 5. Create the trigger function for auto-generating display_id
CREATE OR REPLACE FUNCTION generate_service_display_id()
RETURNS TRIGGER AS $$
DECLARE
  current_year smallint;
  next_number integer;
BEGIN
  -- Skip if display_id already set
  IF NEW.display_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  current_year := (EXTRACT(YEAR FROM CURRENT_DATE)::integer % 100)::smallint;

  -- Atomically increment the counter for this year
  INSERT INTO service_counters (year, last_number, updated_at)
  VALUES (current_year, 1, now())
  ON CONFLICT (year) DO UPDATE
    SET last_number = service_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO next_number;

  -- Format: #YY-NNNN (e.g., #26-0142)
  NEW.display_id := '#' ||
    lpad(current_year::text, 2, '0') || '-' ||
    lpad(next_number::text, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- 6. Attach trigger to services table
DROP TRIGGER IF EXISTS services_before_insert_display_id ON services;
CREATE TRIGGER services_before_insert_display_id
  BEFORE INSERT ON services
  FOR EACH ROW
  EXECUTE FUNCTION generate_service_display_id();

-- 7. Backfill existing services (assign IDs in creation order per year)
WITH numbered AS (
  SELECT
    id,
    (EXTRACT(YEAR FROM created_at)::integer % 100) as yr,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM created_at)
      ORDER BY created_at
    ) as seq
  FROM services
  WHERE display_id IS NULL
)
UPDATE services s
SET display_id = '#' || lpad(n.yr::text, 2, '0') || '-' || lpad(n.seq::text, 4, '0')
FROM numbered n
WHERE s.id = n.id;

-- 8. Update counter table with current max values
INSERT INTO service_counters (year, last_number, updated_at)
SELECT
  (EXTRACT(YEAR FROM created_at)::integer % 100)::smallint,
  COUNT(*)::integer,
  now()
FROM services
WHERE display_id IS NOT NULL
GROUP BY EXTRACT(YEAR FROM created_at)
ON CONFLICT (year) DO UPDATE
SET last_number = GREATEST(service_counters.last_number, EXCLUDED.last_number);

-- 9. Add unique index for display_id lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_display_id_unique
  ON services(display_id) WHERE display_id IS NOT NULL;
```

**Step 2: Apply the migration**

Run: `supabase db push`
Expected: Migration applies successfully, existing services get backfilled

**Step 3: Verify in Supabase**

Run: `supabase db diff` (should show no pending changes)

**Step 4: Commit**

```bash
git add supabase/migrations/20260129000001_add_service_display_ids.sql
git commit -m "feat(db): add service display IDs, recipient fields, label branding

- Counter table for year-based sequential IDs (#YY-NNNN)
- Trigger auto-generates display_id on insert
- Backfill existing services
- Add recipient_name, recipient_phone, customer_reference to services
- Add label_business_name, label_tagline to profiles"
```

---

## Task 2: Regenerate TypeScript Types

**Files:**
- Modify: `src/lib/database.generated.ts` (auto-generated)
- Modify: `src/lib/database.types.ts` (if needed)

**Step 1: Regenerate types from database**

Run: `pnpm run types:generate`
Expected: `database.generated.ts` updated with new columns

**Step 2: Verify new fields exist**

Check that `services` type now includes:
- `display_id: string | null`
- `customer_reference: string | null`
- `recipient_name: string | null`
- `recipient_phone: string | null`

Check that `profiles` type now includes:
- `label_business_name: string | null`
- `label_tagline: string | null`

**Step 3: Commit**

```bash
git add src/lib/database.generated.ts src/lib/database.types.ts
git commit -m "chore: regenerate database types with new service fields"
```

---

## Task 3: Add i18n Translation Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English translations**

Add to `messages/en.json`:

```json
"service_id": "Service ID",
"service_id_copied": "Service ID copied!",

"customer_reference": "Your Reference",
"customer_reference_help": "Your internal reference (PO number, invoice, etc.)",
"customer_reference_placeholder": "PO-12345",

"recipient": "Recipient",
"recipient_optional": "Recipient (optional)",
"recipient_name": "Recipient Name",
"recipient_phone": "Recipient Phone",
"recipient_name_placeholder": "Dr. João Silva",
"recipient_phone_placeholder": "+351 912 345 678",

"print_label": "Print Label",
"print": "Print",
"label_branding": "Label Branding",
"label_branding_desc": "Customize how your business appears on printed labels",
"label_business_name": "Business Name",
"label_business_name_placeholder": "Your Company Name",
"label_tagline": "Tagline",
"label_tagline_placeholder": "Fast & Secure Deliveries",
"label_tagline_help": "Optional text below your name on labels",
"label_from": "FROM",
"label_to": "TO",
"label_scan_to_track": "Scan to track",
"label_delivery": "DELIVERY",
"label_pickup": "PICKUP",
"label_notes": "Notes"
```

**Step 2: Add Portuguese translations**

Add to `messages/pt-PT.json`:

```json
"service_id": "ID do Serviço",
"service_id_copied": "ID do serviço copiado!",

"customer_reference": "A Sua Referência",
"customer_reference_help": "A sua referência interna (nº encomenda, fatura, etc.)",
"customer_reference_placeholder": "PO-12345",

"recipient": "Destinatário",
"recipient_optional": "Destinatário (opcional)",
"recipient_name": "Nome do Destinatário",
"recipient_phone": "Telefone do Destinatário",
"recipient_name_placeholder": "Dr. João Silva",
"recipient_phone_placeholder": "+351 912 345 678",

"print_label": "Imprimir Etiqueta",
"print": "Imprimir",
"label_branding": "Marca da Etiqueta",
"label_branding_desc": "Personalize como a sua empresa aparece nas etiquetas impressas",
"label_business_name": "Nome da Empresa",
"label_business_name_placeholder": "Nome da Sua Empresa",
"label_tagline": "Slogan",
"label_tagline_placeholder": "Entregas Rápidas e Seguras",
"label_tagline_help": "Texto opcional abaixo do nome nas etiquetas",
"label_from": "DE",
"label_to": "PARA",
"label_scan_to_track": "Digitalize para acompanhar",
"label_delivery": "ENTREGA",
"label_pickup": "RECOLHA",
"label_notes": "Notas"
```

**Step 3: Build to verify no syntax errors**

Run: `pnpm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "feat(i18n): add translations for service IDs, recipients, labels"
```

---

## Task 4: Update Service Card Component

**Files:**
- Modify: `src/lib/components/ServiceCard.svelte`

**Step 1: Add display_id to the card**

In `ServiceCard.svelte`, after the checkbox/status dot div and before the client name, add:

```svelte
{#if service.display_id}
  <span class="font-mono text-xs text-muted-foreground">
    {service.display_id}
  </span>
{/if}
```

The full structure in the content area should be:
```svelte
<div class="min-w-0 flex-1 space-y-1">
  {#if service.display_id}
    <span class="font-mono text-xs text-muted-foreground">
      {service.display_id}
    </span>
  {/if}
  <div class="flex items-center justify-between gap-2">
    <p class="font-semibold truncate">
      <!-- existing client name or route -->
    </p>
    <!-- existing status badge -->
  </div>
  <!-- rest of card content -->
</div>
```

**Step 2: Test visually**

Run: `pnpm run dev`
Navigate to services list, verify display ID appears above client name

**Step 3: Commit**

```bash
git add src/lib/components/ServiceCard.svelte
git commit -m "feat(ui): show display_id on service cards"
```

---

## Task 5: Update Service Detail Page - Display ID & Copy Button

**Files:**
- Modify: `src/routes/courier/services/[id]/+page.svelte`

**Step 1: Add Copy icon import**

Add to imports:
```typescript
import { Copy } from '@lucide/svelte';
```

**Step 2: Add copy function and state**

Add after the existing state declarations:
```typescript
let idCopied = $state(false);

async function copyDisplayId() {
  if (service.display_id) {
    await navigator.clipboard.writeText(service.display_id);
    idCopied = true;
    setTimeout(() => idCopied = false, 2000);
  }
}
```

**Step 3: Add display ID to the status card**

In the Card.Content of the status badge card (around line 209), add before the existing status badges:

```svelte
<Card.Content class="space-y-3 p-4">
  <!-- NEW: Display ID with copy button -->
  {#if service.display_id}
    <div class="flex items-center gap-2">
      <span class="font-mono text-lg font-semibold">{service.display_id}</span>
      <Button variant="ghost" size="sm" onclick={copyDisplayId} class="h-7 px-2">
        <Copy class="size-4" />
      </Button>
      {#if idCopied}
        <span class="text-xs text-green-600">{m.service_id_copied()}</span>
      {/if}
    </div>
  {/if}
  {#if service.customer_reference}
    <p class="text-sm text-muted-foreground">
      {m.customer_reference()}: {service.customer_reference}
    </p>
  {/if}

  <!-- existing status badges and actions below -->
  <div class="flex flex-wrap items-center gap-2">
    <!-- ... existing content ... -->
```

**Step 4: Test**

Run dev server, go to service detail, verify ID shows with working copy button

**Step 5: Commit**

```bash
git add src/routes/courier/services/[id]/+page.svelte
git commit -m "feat(ui): add display ID with copy button to service detail"
```

---

## Task 6: Update Service Detail Page - Recipient Card

**Files:**
- Modify: `src/routes/courier/services/[id]/+page.svelte`

**Step 1: Add UserCheck icon import**

Add to imports:
```typescript
import { UserCheck } from '@lucide/svelte';
```

**Step 2: Add Recipient card after ServiceLocationCard**

After the `<ServiceLocationCard ... />` component (around line 304), add:

```svelte
<!-- Recipient Info (conditional) -->
{#if service.recipient_name || service.recipient_phone}
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <UserCheck class="size-5" />
        {m.recipient()}
      </Card.Title>
    </Card.Header>
    <Card.Content class="space-y-1">
      {#if service.recipient_name}
        <p class="font-medium">{service.recipient_name}</p>
      {/if}
      {#if service.recipient_phone}
        <a href="tel:{service.recipient_phone}" class="text-sm text-primary hover:underline">
          {service.recipient_phone}
        </a>
      {/if}
    </Card.Content>
  </Card.Root>
{/if}
```

**Step 3: Test**

Verify card only appears when recipient fields are set

**Step 4: Commit**

```bash
git add src/routes/courier/services/[id]/+page.svelte
git commit -m "feat(ui): add recipient card to service detail page"
```

---

## Task 7: Update Courier New Service Form

**Files:**
- Modify: `src/routes/courier/services/new/+page.svelte`
- Modify: `src/routes/courier/services/new/+page.server.ts`

**Step 1: Add form state variables**

Add after `let notes = $state('');`:
```typescript
let recipientName = $state('');
let recipientPhone = $state('');
let customerReference = $state('');
```

**Step 2: Add form fields in the template**

After the delivery location AddressInput and before notes, add:

```svelte
<Separator />

<!-- Recipient Section -->
<div class="space-y-4">
  <h3 class="text-sm font-medium text-muted-foreground">{m.recipient_optional()}</h3>
  <div class="grid gap-4 sm:grid-cols-2">
    <div class="space-y-2">
      <Label for="recipient_name">{m.recipient_name()}</Label>
      <Input
        id="recipient_name"
        name="recipient_name"
        bind:value={recipientName}
        placeholder={m.recipient_name_placeholder()}
      />
    </div>
    <div class="space-y-2">
      <Label for="recipient_phone">{m.recipient_phone()}</Label>
      <Input
        id="recipient_phone"
        name="recipient_phone"
        type="tel"
        bind:value={recipientPhone}
        placeholder={m.recipient_phone_placeholder()}
      />
    </div>
  </div>
</div>

<!-- Customer Reference -->
<div class="space-y-2">
  <Label for="customer_reference">{m.customer_reference()}</Label>
  <Input
    id="customer_reference"
    name="customer_reference"
    bind:value={customerReference}
    placeholder={m.customer_reference_placeholder()}
  />
  <p class="text-xs text-muted-foreground">{m.customer_reference_help()}</p>
</div>

<Separator />
```

**Step 3: Update +page.server.ts to handle new fields**

In the form action, add to the insert object:
```typescript
recipient_name: formData.get('recipient_name') as string || null,
recipient_phone: formData.get('recipient_phone') as string || null,
customer_reference: formData.get('customer_reference') as string || null,
```

**Step 4: Test**

Create a new service with recipient info, verify it saves

**Step 5: Commit**

```bash
git add src/routes/courier/services/new/+page.svelte src/routes/courier/services/new/+page.server.ts
git commit -m "feat(form): add recipient and customer reference to courier new service form"
```

---

## Task 8: Update Courier Edit Service Form

**Files:**
- Modify: `src/routes/courier/services/[id]/edit/+page.svelte`
- Modify: `src/routes/courier/services/[id]/edit/+page.server.ts`

**Step 1: Add state for new fields (prefilled from service)**

```typescript
let recipientName = $state(data.service.recipient_name || '');
let recipientPhone = $state(data.service.recipient_phone || '');
let customerReference = $state(data.service.customer_reference || '');
```

**Step 2: Add form fields (same as Task 7)**

Add the same recipient section and customer reference fields as in Task 7.

**Step 3: Update +page.server.ts**

Add to the update object:
```typescript
recipient_name: formData.get('recipient_name') as string || null,
recipient_phone: formData.get('recipient_phone') as string || null,
customer_reference: formData.get('customer_reference') as string || null,
```

**Step 4: Test**

Edit an existing service, add/modify recipient info, verify it saves

**Step 5: Commit**

```bash
git add src/routes/courier/services/[id]/edit/+page.svelte src/routes/courier/services/[id]/edit/+page.server.ts
git commit -m "feat(form): add recipient and customer reference to courier edit service form"
```

---

## Task 9: Update Client New Service Form

**Files:**
- Modify: `src/routes/client/new/+page.svelte`
- Modify: `src/routes/client/new/+page.server.ts`

**Step 1: Add form state**

```typescript
let recipientName = $state('');
let recipientPhone = $state('');
let customerReference = $state('');
```

**Step 2: Add form fields**

Same recipient and customer reference fields as previous tasks.

**Step 3: Update +page.server.ts**

Add fields to the insert:
```typescript
recipient_name: formData.get('recipient_name') as string || null,
recipient_phone: formData.get('recipient_phone') as string || null,
customer_reference: formData.get('customer_reference') as string || null,
```

**Step 4: Test as client**

Log in as client, create service request with recipient info

**Step 5: Commit**

```bash
git add src/routes/client/new/+page.svelte src/routes/client/new/+page.server.ts
git commit -m "feat(form): add recipient and customer reference to client service request form"
```

---

## Task 10: Add Label Branding to Courier Settings

**Files:**
- Modify: `src/routes/courier/settings/AccountTab.svelte`
- Modify: `src/routes/courier/settings/+page.server.ts`

**Step 1: Add Label Branding card to AccountTab.svelte**

Add after the Default Location card:

```svelte
<!-- Label Branding -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Tag class="size-5" />
      {m.label_branding()}
    </Card.Title>
    <Card.Description>{m.label_branding_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form method="POST" action="?/updateLabelBranding" use:enhance class="space-y-4">
      <div class="space-y-2">
        <Label for="label_business_name">{m.label_business_name()}</Label>
        <Input
          id="label_business_name"
          name="label_business_name"
          value={profile.label_business_name || ''}
          placeholder={m.label_business_name_placeholder()}
        />
      </div>
      <div class="space-y-2">
        <Label for="label_tagline">{m.label_tagline()}</Label>
        <Input
          id="label_tagline"
          name="label_tagline"
          value={profile.label_tagline || ''}
          placeholder={m.label_tagline_placeholder()}
        />
        <p class="text-xs text-muted-foreground">{m.label_tagline_help()}</p>
      </div>
      <Button type="submit">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>
```

**Step 2: Add Tag icon import**

```typescript
import { User, Warehouse, Tag } from '@lucide/svelte';
```

**Step 3: Add form action in +page.server.ts**

```typescript
updateLabelBranding: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) return fail(401, { error: 'Unauthorized' });

  const formData = await request.formData();
  const labelBusinessName = formData.get('label_business_name') as string || null;
  const labelTagline = formData.get('label_tagline') as string || null;

  const { error } = await supabase
    .from('profiles')
    .update({
      label_business_name: labelBusinessName,
      label_tagline: labelTagline
    })
    .eq('id', session.user.id);

  if (error) return fail(500, { error: error.message });
  return { success: true };
}
```

**Step 4: Test**

Save label branding settings, verify they persist

**Step 5: Commit**

```bash
git add src/routes/courier/settings/AccountTab.svelte src/routes/courier/settings/+page.server.ts
git commit -m "feat(settings): add label branding configuration for courier"
```

---

## Task 11: Install QR Code Library

**Files:**
- Modify: `package.json`

**Step 1: Install qrcode package**

Run: `pnpm add qrcode @types/qrcode`

**Step 2: Verify installation**

Run: `pnpm run check`
Expected: No errors

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add qrcode library for label generation"
```

---

## Task 12: Create ServiceLabel Component

**Files:**
- Create: `src/lib/components/ServiceLabel.svelte`

**Step 1: Create the component**

```svelte
<script lang="ts">
  import QRCode from 'qrcode';
  import { formatDate, formatTimeSlot } from '$lib/utils.js';
  import * as m from '$lib/paraglide/messages.js';
  import type { Service } from '$lib/database.types.js';

  interface ServiceLabelProps {
    service: Service;
    courierProfile: {
      name: string;
      phone?: string | null;
      label_business_name?: string | null;
      label_tagline?: string | null;
    };
    clientName: string;
  }

  let { service, courierProfile, clientName }: ServiceLabelProps = $props();

  let qrDataUrl = $state('');

  const businessName = $derived(courierProfile.label_business_name || courierProfile.name);
  const tagline = $derived(courierProfile.label_tagline);
  const trackingUrl = $derived(`${window.location.origin}/track/${service.display_id}`);

  $effect(() => {
    generateQR();
  });

  async function generateQR() {
    try {
      qrDataUrl = await QRCode.toDataURL(trackingUrl, {
        width: 100,
        margin: 1,
        errorCorrectionLevel: 'M'
      });
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  }
</script>

<div class="service-label">
  <!-- Header: Courier Branding -->
  <div class="label-header">
    <div class="business-name">{businessName}</div>
    {#if tagline}
      <div class="tagline">{tagline}</div>
    {/if}
    {#if courierProfile.phone}
      <div class="phone">{courierProfile.phone}</div>
    {/if}
  </div>

  <!-- Service Info -->
  <div class="label-service-info">
    <div class="display-id">{service.display_id}</div>
    <div class="service-badge">
      {m.label_delivery()}
    </div>
    {#if service.scheduled_date}
      <div class="schedule">
        {formatDate(service.scheduled_date)}
        {#if service.scheduled_time_slot}
          · {service.scheduled_time_slot === 'specific' && service.scheduled_time
            ? service.scheduled_time
            : formatTimeSlot(service.scheduled_time_slot)}
        {/if}
      </div>
    {/if}
  </div>

  <!-- From Address -->
  <div class="label-address from">
    <div class="address-label">{m.label_from()}:</div>
    <div class="address-name">{clientName}</div>
    <div class="address-text">{service.pickup_location}</div>
  </div>

  <!-- To Address -->
  <div class="label-address to">
    <div class="address-label">{m.label_to()}:</div>
    {#if service.recipient_name}
      <div class="address-name">{service.recipient_name}</div>
    {/if}
    <div class="address-text">{service.delivery_location}</div>
    {#if service.recipient_phone}
      <div class="address-phone">Tel: {service.recipient_phone}</div>
    {/if}
  </div>

  <!-- Notes -->
  {#if service.notes}
    <div class="label-notes">
      {service.notes}
    </div>
  {/if}

  <!-- QR Code -->
  <div class="label-qr">
    {#if qrDataUrl}
      <img src={qrDataUrl} alt="QR Code" class="qr-image" />
    {/if}
    <div class="qr-info">
      <div class="qr-id">{service.display_id}</div>
      <div class="qr-hint">{m.label_scan_to_track()}</div>
    </div>
  </div>
</div>

<style>
  .service-label {
    width: 100mm;
    min-height: 150mm;
    padding: 4mm;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    background: white;
    color: black;
    border: 1px solid #ccc;
  }

  .label-header {
    text-align: center;
    padding-bottom: 3mm;
    border-bottom: 1px solid #333;
    margin-bottom: 3mm;
  }

  .business-name {
    font-size: 14pt;
    font-weight: bold;
  }

  .tagline {
    font-size: 9pt;
    color: #555;
  }

  .phone {
    font-size: 9pt;
  }

  .label-service-info {
    display: flex;
    align-items: center;
    gap: 3mm;
    padding: 2mm 0;
    border-bottom: 1px solid #ddd;
    margin-bottom: 3mm;
  }

  .display-id {
    font-family: monospace;
    font-size: 12pt;
    font-weight: bold;
  }

  .service-badge {
    background: #333;
    color: white;
    padding: 1mm 2mm;
    font-size: 8pt;
    font-weight: bold;
    border-radius: 2px;
  }

  .schedule {
    font-size: 9pt;
    color: #555;
  }

  .label-address {
    padding: 2mm 0;
    border-bottom: 1px solid #eee;
  }

  .label-address.to {
    border-bottom: 1px solid #ddd;
  }

  .address-label {
    font-size: 8pt;
    font-weight: bold;
    color: #666;
  }

  .address-name {
    font-size: 11pt;
    font-weight: bold;
  }

  .address-text {
    font-size: 10pt;
  }

  .address-phone {
    font-size: 9pt;
    color: #555;
  }

  .label-notes {
    padding: 2mm 0;
    font-size: 9pt;
    font-style: italic;
    border-bottom: 1px solid #ddd;
  }

  .label-qr {
    display: flex;
    align-items: center;
    gap: 3mm;
    padding-top: 3mm;
  }

  .qr-image {
    width: 25mm;
    height: 25mm;
  }

  .qr-info {
    flex: 1;
  }

  .qr-id {
    font-family: monospace;
    font-size: 11pt;
    font-weight: bold;
  }

  .qr-hint {
    font-size: 8pt;
    color: #666;
  }

  /* Print styles */
  @media print {
    .service-label {
      border: none;
      margin: 0;
      padding: 5mm;
    }
  }
</style>
```

**Step 2: Verify component compiles**

Run: `pnpm run check`

**Step 3: Commit**

```bash
git add src/lib/components/ServiceLabel.svelte
git commit -m "feat(ui): create ServiceLabel component for printable labels"
```

---

## Task 13: Add Print Label Dialog to Service Detail

**Files:**
- Modify: `src/routes/courier/services/[id]/+page.svelte`
- Modify: `src/routes/courier/services/[id]/+page.server.ts` (if needed for courier profile)

**Step 1: Add imports**

```typescript
import { Printer } from '@lucide/svelte';
import ServiceLabel from '$lib/components/ServiceLabel.svelte';
```

**Step 2: Add state for print dialog**

```typescript
let showPrintDialog = $state(false);
```

**Step 3: Add print function**

```typescript
function handlePrint() {
  window.print();
}
```

**Step 4: Add Print Label button to quick actions**

In the quick actions area (around line 224), add:

```svelte
<Button variant="outline" size="sm" onclick={() => showPrintDialog = true}>
  <Printer class="mr-2 size-4" />
  {m.print_label()}
</Button>
```

**Step 5: Add Print Dialog at the end of the component**

```svelte
<!-- Print Label Dialog -->
<AlertDialog.Root bind:open={showPrintDialog}>
  <AlertDialog.Content class="max-w-lg print:max-w-none print:p-0 print:border-none print:shadow-none">
    <AlertDialog.Header class="print:hidden">
      <AlertDialog.Title>{m.print_label()}</AlertDialog.Title>
    </AlertDialog.Header>

    <div class="flex justify-center py-4 print:py-0">
      <ServiceLabel
        {service}
        courierProfile={{
          name: data.profile.name,
          phone: data.profile.phone,
          label_business_name: data.profile.label_business_name,
          label_tagline: data.profile.label_tagline
        }}
        clientName={client.name}
      />
    </div>

    <AlertDialog.Footer class="print:hidden">
      <AlertDialog.Cancel>{m.action_cancel()}</AlertDialog.Cancel>
      <Button onclick={handlePrint}>
        <Printer class="mr-2 size-4" />
        {m.print()}
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
```

**Step 6: Update +page.server.ts to include label branding fields**

Ensure the profile query includes `label_business_name` and `label_tagline`.

**Step 7: Add print CSS to hide non-label elements**

Add to `app.css` or create inline:

```css
@media print {
  body > *:not([data-print]) {
    display: none !important;
  }

  [data-dialog-content] {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    max-width: none !important;
    border: none !important;
    box-shadow: none !important;
    background: white !important;
  }
}
```

**Step 8: Test**

Open service detail, click Print Label, verify preview shows correctly, test browser print

**Step 9: Commit**

```bash
git add src/routes/courier/services/[id]/+page.svelte src/routes/courier/services/[id]/+page.server.ts src/app.css
git commit -m "feat(ui): add print label dialog to service detail page"
```

---

## Task 14: Add Print Label to Client Service Detail

**Files:**
- Modify: `src/routes/client/services/[id]/+page.svelte` (if exists) or create equivalent

**Step 1: Check if client service detail page exists**

If it exists, add similar print functionality as Task 13.
If not, skip this task.

**Step 2: Commit**

```bash
git add src/routes/client/...
git commit -m "feat(ui): add print label to client service detail"
```

---

## Task 15: Final Testing & Verification

**Step 1: Full flow test as courier**

1. Create new service with recipient info and customer reference
2. Verify display_id is auto-generated
3. View service detail - verify all new fields display
4. Copy display_id - verify clipboard works
5. Print label - verify all fields appear correctly
6. Edit label branding in settings
7. Print label again - verify branding updated

**Step 2: Full flow test as client**

1. Create service request with recipient info and customer reference
2. View service detail - verify fields display
3. Print label - verify courier branding appears

**Step 3: Test backfill**

Verify existing services have display_id assigned in correct order

**Step 4: Run full test suite**

Run: `pnpm run check && pnpm run build`
Expected: All checks pass, build succeeds

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete service details enhancements

- Human-readable service IDs (#YY-NNNN format)
- Recipient name and phone tracking
- Customer reference field
- Printable labels with QR codes
- Courier label branding settings

Closes #XXX"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | 1 new migration |
| 2 | Regenerate types | database.generated.ts |
| 3 | i18n translations | messages/*.json |
| 4 | Service card | ServiceCard.svelte |
| 5-6 | Service detail (ID, recipient) | courier/services/[id]/+page.svelte |
| 7 | Courier new form | courier/services/new/* |
| 8 | Courier edit form | courier/services/[id]/edit/* |
| 9 | Client new form | client/new/* |
| 10 | Settings - label branding | courier/settings/* |
| 11 | QR library | package.json |
| 12 | ServiceLabel component | ServiceLabel.svelte |
| 13-14 | Print dialog | service detail pages |
| 15 | Testing | - |

**Total: ~15 tasks, ~12 commits**
