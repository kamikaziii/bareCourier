# Service Details Enhancements

**Date:** 2025-01-29
**Status:** Approved
**Author:** Filipe Garrido + Claude

## Overview

Enhance service tracking with human-readable IDs, recipient information, and printable labels. Based on industry research and courier workflow analysis.

## Goals

1. Enable quick verbal/phone reference to services (`#25-0142`)
2. Track delivery recipients (often different from ordering client)
3. Allow clients to attach their own reference numbers (PO, invoice)
4. Generate printable labels for packages

## Non-Goals

- Proof of delivery (photo/signature) - deferred
- Public tracking page - deferred (QR code will link to it later)
- Thermal printer integration - deferred (browser print first)
- Logo upload for labels - deferred

---

## Database Changes

### New Table: `service_counters`

Tracks year-based sequential numbering for display IDs.

```sql
CREATE TABLE service_counters (
  year smallint PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: No direct access (trigger-only)
ALTER TABLE service_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_counters_no_direct_access"
  ON service_counters FOR ALL
  USING (false);
```

### New Columns: `services`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `display_id` | text | NO | (trigger) | Human-readable ID like `#25-0142` |
| `customer_reference` | text | YES | NULL | Client's PO/invoice number |
| `recipient_name` | text | YES | NULL | Person receiving the delivery |
| `recipient_phone` | text | YES | NULL | Recipient contact number |

```sql
ALTER TABLE services ADD COLUMN display_id text;
ALTER TABLE services ADD COLUMN customer_reference text;
ALTER TABLE services ADD COLUMN recipient_name text;
ALTER TABLE services ADD COLUMN recipient_phone text;

CREATE UNIQUE INDEX idx_services_display_id ON services(display_id) WHERE display_id IS NOT NULL;
```

### New Columns: `profiles` (courier only)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `label_business_name` | text | YES | NULL | Business name shown on labels |
| `label_tagline` | text | YES | NULL | Optional tagline below name |

```sql
ALTER TABLE profiles ADD COLUMN label_business_name text;
ALTER TABLE profiles ADD COLUMN label_tagline text;
```

### Trigger: Auto-generate `display_id`

Uses counter table pattern (no cron needed, automatic year reset):

```sql
CREATE OR REPLACE FUNCTION generate_service_display_id()
RETURNS TRIGGER AS $$
DECLARE
  current_year smallint;
  next_number integer;
BEGIN
  IF NEW.display_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  current_year := (EXTRACT(YEAR FROM CURRENT_DATE)::integer % 100)::smallint;

  INSERT INTO service_counters (year, last_number, updated_at)
  VALUES (current_year, 1, now())
  ON CONFLICT (year) DO UPDATE
    SET last_number = service_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO next_number;

  NEW.display_id := '#' ||
    lpad(current_year::text, 2, '0') || '-' ||
    lpad(next_number::text, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER services_before_insert_display_id
  BEFORE INSERT ON services
  FOR EACH ROW
  EXECUTE FUNCTION generate_service_display_id();
```

### Backfill Existing Services

```sql
-- Assign IDs in creation order within each year
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

-- Sync counter table
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
```

---

## UI Changes

### 1. Service Card (`ServiceCard.svelte`)

Add display ID in muted monospace before client name:

```svelte
<span class="font-mono text-xs text-muted-foreground">
  {service.display_id}
</span>
```

**Layout:**
```
┌─────────────────────────────────────────────┐
│ #25-0142                       [PENDING]    │
│ Acme Corp                                   │
│ 📍 123 Main St → 456 Oak Ave               │
│ 📅 Today, 2:00 PM                          │
└─────────────────────────────────────────────┘
```

### 2. Service Detail Page (`/courier/services/[id]/+page.svelte`)

**Header changes:**
- Add display ID prominently with copy-to-clipboard button
- Show customer reference if set

```svelte
<div class="flex items-center gap-2">
  <span class="font-mono text-lg font-semibold">{service.display_id}</span>
  <Button variant="ghost" size="sm" onclick={copyId}>
    <Copy class="size-4" />
  </Button>
</div>
{#if service.customer_reference}
  <p class="text-sm text-muted-foreground">
    Ref: {service.customer_reference}
  </p>
{/if}
```

**New Recipient Card** (after locations, conditional):

```svelte
{#if service.recipient_name || service.recipient_phone}
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <UserCheck class="size-5" />
        {m.recipient()}
      </Card.Title>
    </Card.Header>
    <Card.Content>
      {#if service.recipient_name}
        <p class="font-medium">{service.recipient_name}</p>
      {/if}
      {#if service.recipient_phone}
        <a href="tel:{service.recipient_phone}" class="text-sm text-primary">
          {service.recipient_phone}
        </a>
      {/if}
    </Card.Content>
  </Card.Root>
{/if}
```

**Print Label Button:**

Add to quick actions area:

```svelte
<Button variant="outline" size="sm" onclick={() => showPrintDialog = true}>
  <Printer class="mr-2 size-4" />
  {m.print_label()}
</Button>
```

### 3. Service Forms

**Files to modify:**
- `src/routes/courier/services/new/+page.svelte`
- `src/routes/courier/services/[id]/edit/+page.svelte`
- `src/routes/client/new/+page.svelte`

**New fields after delivery location:**

```svelte
<!-- Recipient Section -->
<div class="space-y-4">
  <h3 class="text-sm font-medium text-muted-foreground">{m.recipient_optional()}</h3>
  <div class="grid gap-4 sm:grid-cols-2">
    <div class="space-y-2">
      <Label for="recipient_name">{m.recipient_name()}</Label>
      <Input
        id="recipient_name"
        name="recipient_name"
        value={recipientName}
        placeholder="Dr. João Silva"
      />
    </div>
    <div class="space-y-2">
      <Label for="recipient_phone">{m.recipient_phone()}</Label>
      <Input
        id="recipient_phone"
        name="recipient_phone"
        type="tel"
        value={recipientPhone}
        placeholder="+351 912 345 678"
      />
    </div>
  </div>
</div>

<!-- Customer Reference (client form only, or courier creating for client) -->
<div class="space-y-2">
  <Label for="customer_reference">{m.customer_reference()}</Label>
  <Input
    id="customer_reference"
    name="customer_reference"
    value={customerReference}
    placeholder="PO-12345"
  />
  <p class="text-xs text-muted-foreground">{m.customer_reference_help()}</p>
</div>
```

### 4. Courier Settings Page

**New section in `/courier/settings/+page.svelte`:**

```svelte
<Card.Root>
  <Card.Header>
    <Card.Title>{m.label_branding()}</Card.Title>
    <Card.Description>{m.label_branding_desc()}</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-4">
    <div class="space-y-2">
      <Label for="label_business_name">{m.label_business_name()}</Label>
      <Input
        id="label_business_name"
        bind:value={labelBusinessName}
        placeholder="Agostinho Santos"
      />
    </div>
    <div class="space-y-2">
      <Label for="label_tagline">{m.label_tagline()}</Label>
      <Input
        id="label_tagline"
        bind:value={labelTagline}
        placeholder="Entregas Rápidas e Seguras"
      />
      <p class="text-xs text-muted-foreground">{m.label_tagline_help()}</p>
    </div>
  </Card.Content>
</Card.Root>
```

---

## Print Label Feature

### Component: `ServiceLabel.svelte`

New component for rendering printable labels.

**Props:**
```typescript
interface ServiceLabelProps {
  service: Service;
  courierProfile: {
    name: string;
    phone: string;
    label_business_name?: string;
    label_tagline?: string;
  };
  clientName: string;
}
```

**Label Layout (simplified, ~4x6"):**

```
+============================================+
|                                            |
|  AGOSTINHO SANTOS                          |
|  Entregas Rápidas e Seguras                |
|  +351 912 345 678                          |
|                                            |
+--------------------------------------------+
|  #25-0142              [ ENTREGA ]         |
|  29 Jan 2025 · Manhã                       |
+--------------------------------------------+
|                                            |
|  DE:  Farmácia Central                     |
|       Av. da República 123                 |
|       1050-001 Lisboa                      |
|                                            |
+--------------------------------------------+
|                                            |
|  PARA:  LABORATÓRIO ABC                    |
|         Dr. João Silva                     |
|         Rua da Saúde 456, 2º Esq           |
|         4000-123 Porto                     |
|         Tel: 923 456 789                   |
|                                            |
+--------------------------------------------+
|  Entregar na receção antes das 10h         |
+--------------------------------------------+
|                                            |
|     +--------+   #25-0142                  |
|     |   QR   |   Digitalizar para          |
|     +--------+   acompanhar                |
|                                            |
+============================================+
```

**Implementation notes:**
- Use `@media print` CSS for print-specific styling
- Hide everything except label when printing
- QR code generated with `qrcode` npm package (or similar)
- QR links to `/track/{display_id}` (page to be implemented later)
- "ENTREGA" badge changes to "RECOLHA" for pickup-type services

### Print Dialog

Simple dialog with print preview and button:

```svelte
<AlertDialog.Root bind:open={showPrintDialog}>
  <AlertDialog.Content class="max-w-2xl">
    <AlertDialog.Header>
      <AlertDialog.Title>{m.print_label()}</AlertDialog.Title>
    </AlertDialog.Header>

    <div class="border rounded-lg p-4 bg-white">
      <ServiceLabel {service} {courierProfile} {clientName} />
    </div>

    <AlertDialog.Footer>
      <AlertDialog.Cancel>{m.action_cancel()}</AlertDialog.Cancel>
      <Button onclick={handlePrint}>
        <Printer class="mr-2 size-4" />
        {m.print()}
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
```

---

## i18n Keys

New translation keys to add:

```typescript
// Service ID
service_id: "Service ID",
service_id_copied: "Service ID copied!",

// Customer reference
customer_reference: "Your Reference",
customer_reference_help: "Your internal reference (PO number, invoice, etc.)",

// Recipient
recipient: "Recipient",
recipient_optional: "Recipient (optional)",
recipient_name: "Name",
recipient_phone: "Phone",

// Label
print_label: "Print Label",
label_branding: "Label Branding",
label_branding_desc: "Customize how your business appears on printed labels",
label_business_name: "Business Name",
label_tagline: "Tagline",
label_tagline_help: "Optional text below your name (e.g., 'Fast & Secure Deliveries')",
label_from: "FROM",
label_to: "TO",
label_scan_to_track: "Scan to track",
label_delivery: "DELIVERY",
label_pickup: "PICKUP",
```

---

## Implementation Order

```
1. Database Migration
   ├── Create service_counters table
   ├── Add columns to services (display_id, customer_reference, recipient_*)
   ├── Add columns to profiles (label_business_name, label_tagline)
   ├── Create trigger function
   └── Backfill existing services

2. TypeScript Types
   └── Regenerate database.types.ts

3. Service Card
   └── Add display_id display

4. Service Detail Page
   ├── Add display_id header with copy button
   ├── Add customer reference display
   ├── Add Recipient card (conditional)
   └── Add Print Label button + dialog

5. Service Forms (parallel)
   ├── Courier: new service form
   ├── Courier: edit service form
   └── Client: service request form

6. Courier Settings
   └── Add Label Branding section

7. Print Label Component
   ├── Create ServiceLabel.svelte
   ├── Add print-specific CSS
   └── Integrate QR code generation

8. i18n
   └── Add all new translation keys (PT + EN)
```

---

## Testing Checklist

- [ ] New service gets auto-generated `display_id`
- [ ] Display ID is unique and sequential within year
- [ ] First service of new year starts at `#YY-0001`
- [ ] Service card shows display ID
- [ ] Service detail shows ID with working copy button
- [ ] Recipient card appears only when recipient fields are set
- [ ] Customer reference displays when set
- [ ] Forms save all new fields correctly
- [ ] Courier settings save label branding
- [ ] Print label shows correct data
- [ ] Print label uses courier's branding settings
- [ ] QR code generates and is scannable
- [ ] Label prints correctly (browser print)
- [ ] Client can print labels for their services
- [ ] All new strings are translated (PT + EN)

---

## Future Enhancements (Out of Scope)

1. **Public tracking page** (`/track/{display_id}`) - Simple status view without login
2. **Proof of delivery** - Photo capture, signature, GPS timestamp
3. **Thermal printer support** - Direct ESC/POS printing
4. **Logo upload** - Custom logo on labels
5. **Label templates** - Multiple label formats/sizes
