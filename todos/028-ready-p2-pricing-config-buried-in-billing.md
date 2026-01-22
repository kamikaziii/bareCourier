# Client Pricing Configuration Buried in Billing Section - Poor UX

---
status: ready
priority: p2
issue_id: "028"
tags: [code-review, ux, courier, clients, billing]
dependencies: []
---

## Problem Statement

The client pricing/billing plan configuration is completely disconnected from client management. To set up pricing for a client, the courier must navigate to a completely separate section of the app (Billing), find the client in a table, and click through to configure. This is unintuitive and creates a poor onboarding experience for new clients.

**Why it matters**: When the courier creates a new client, the natural expectation is to configure their pricing model at the same time. Currently, pricing setup requires:
1. Navigate to Clients → Create client
2. Navigate to Billing → Find client in table → Click "View"
3. Configure pricing on a separate page

This is 5+ clicks and requires knowing that pricing is in "Billing" not "Clients".

## Current State Analysis

### Client Creation (`/courier/clients`)
**Fields available:**
- Email, Password (required)
- Name (required)
- Phone (optional)
- Default Pickup Location (optional)

**Missing:** Any pricing configuration

### Client Edit (`/courier/clients/[id]/edit`)
**Fields available:**
- Name
- Phone
- Default Pickup Location

**Missing:** Pricing configuration, link to billing

### Client Detail (`/courier/clients/[id]`)
**Tabs:**
- Info (contact, default location, account status)
- Services (service history)

**Missing:**
- Billing/Pricing tab
- Link to configure pricing
- Display of current pricing model

### Billing Detail (`/courier/billing/[client_id]`)
**Contains pricing configuration:**
- Pricing model dropdown (per_km, flat_plus_km, zone)
- Base fee input
- Per km rate input
- Zone configuration (if zone model)
- Service history with financial data

**Problem:** This page is only accessible via Billing → Client row → View button

## User Journey Comparison

### Current (Bad UX):
```
Create Client → [Client created without pricing]
                     ↓
               Navigate to Billing section
                     ↓
               Find client in billing table
                     ↓
               Click "View" button
                     ↓
               Configure pricing model
                     ↓
               Set rates/zones
                     ↓
               Save
```

### Desired (Good UX):
```
Create Client → [Optional: Configure pricing inline]
                     ↓
               Client created with pricing ready
```

OR at minimum:
```
View Client → [See pricing info + "Edit Pricing" link]
```

## Proposed Solutions

### Option 1: Add Pricing Section to Client Forms (Recommended)

**A) Client Creation Form**
Add collapsible "Pricing Configuration" section after basic info:

```svelte
<!-- After contact info fields -->
<Separator />

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h3 class="font-medium">{m.pricing_config_optional()}</h3>
    <Button variant="ghost" size="sm" onclick={() => showPricing = !showPricing}>
      {showPricing ? 'Hide' : 'Configure'}
    </Button>
  </div>

  {#if showPricing}
    <div class="space-y-4 rounded-lg border p-4">
      <!-- Pricing model select -->
      <div class="space-y-2">
        <Label>{m.billing_pricing_model()}</Label>
        <select bind:value={pricingModel}>
          <option value="per_km">{m.billing_model_per_km()}</option>
          <option value="flat_plus_km">{m.billing_model_flat_plus_km()}</option>
          <option value="zone">{m.billing_model_zone()}</option>
        </select>
      </div>

      <!-- Rates based on model -->
      {#if pricingModel !== 'zone'}
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <Label>{m.billing_base_fee()}</Label>
            <Input type="number" bind:value={baseFee} />
          </div>
          <div>
            <Label>{m.billing_per_km_rate()}</Label>
            <Input type="number" bind:value={perKmRate} />
          </div>
        </div>
      {:else}
        <!-- Zone config UI -->
      {/if}
    </div>
  {/if}
</div>
```

**B) Client Edit Form**
Add the same pricing section to the edit form.

**Pros**: Complete integration, natural workflow
**Cons**: More complex forms, need to handle pricing creation/update
**Effort**: Medium (reuse existing pricing UI from billing page)
**Risk**: Low

### Option 2: Add Billing Tab to Client Detail Page

Add a third tab "Billing" to `/courier/clients/[id]` that shows:
- Current pricing model
- Current rates
- Quick edit capability
- Link to full billing detail page

```svelte
<Tabs.Root value="info">
  <Tabs.List>
    <Tabs.Trigger value="info">{m.tab_info()}</Tabs.Trigger>
    <Tabs.Trigger value="billing">{m.tab_billing()}</Tabs.Trigger>
    <Tabs.Trigger value="services">{m.tab_services()}</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="billing">
    <Card.Root>
      <Card.Header>
        <Card.Title>{m.pricing_config()}</Card.Title>
      </Card.Header>
      <Card.Content>
        {#if clientPricing}
          <p>Model: {clientPricing.pricing_model}</p>
          <p>Base: €{clientPricing.base_fee}</p>
          <p>Per km: €{clientPricing.per_km_rate}</p>
        {:else}
          <p>{m.no_pricing_configured()}</p>
        {/if}
        <Button href={localizeHref(`/courier/billing/${client.id}`)}>
          {m.configure_pricing()}
        </Button>
      </Card.Content>
    </Card.Root>
  </Tabs.Content>
</Tabs.Root>
```

**Pros**: Simpler implementation, links existing pages
**Cons**: Still requires navigation to configure, not inline
**Effort**: Small
**Risk**: Low

### Option 3: Minimal - Add Link from Client Detail to Billing

Just add a "Configure Pricing" button to the client detail page header or dropdown menu.

```svelte
<DropdownMenu.Content align="end">
  <DropdownMenu.Item onclick={() => goto(`/courier/billing/${client.id}`)}>
    <Euro class="mr-2 size-4" />
    {m.configure_pricing()}
  </DropdownMenu.Item>
  <!-- ... existing items ... -->
</DropdownMenu.Content>
```

**Pros**: Minimal change, quick win
**Cons**: Doesn't solve the creation flow, still separate pages
**Effort**: Small
**Risk**: Low

### Option 4: Move Pricing Config to Client Edit Page Entirely

Make `/courier/clients/[id]/edit` the single source of truth for client configuration including pricing. Remove pricing from billing detail (keep only service history there).

**Pros**: Single location for all client config
**Cons**: Major restructuring, billing page becomes less useful
**Effort**: High
**Risk**: Medium

## Recommended Action

Implement **all three options together** for complete UX:

1. **Add Pricing Section to Client Create Form** - Allow setting pricing when onboarding a new client
2. **Add Pricing Section to Client Edit Form** - Allow updating pricing alongside other client info
3. **Add Billing Tab to Client Detail Page** - Show current pricing at a glance with quick edit
4. **Add Quick Link in Dropdown** - For fast access to full billing history

These are not alternatives - they all serve different purposes:
- Create form: Initial setup
- Edit form: Updating configuration
- Detail page tab: Viewing current state
- Dropdown link: Access to detailed billing history

**This should be treated as a single implementation task, not phased.**

## Technical Details

### New Shared Component
Create `src/lib/components/PricingConfigForm.svelte`:
- Extract pricing UI from `/courier/billing/[client_id]/+page.svelte`
- Props: `pricing` (existing config or null), `onSave` callback
- Handles all 3 pricing models
- Includes zone validation logic

### Files to Modify

**Client Creation:**
- `src/routes/courier/clients/+page.svelte` - Add PricingConfigForm
- Edge function `create-client` - Accept and save pricing config

**Client Edit:**
- `src/routes/courier/clients/[id]/edit/+page.svelte` - Add PricingConfigForm
- `src/routes/courier/clients/[id]/edit/+page.ts` - Load existing pricing
- `src/routes/courier/clients/[id]/edit/+page.server.ts` - Handle pricing update

**Client Detail:**
- `src/routes/courier/clients/[id]/+page.svelte` - Add Billing tab + dropdown link
- `src/routes/courier/clients/[id]/+page.ts` - Load pricing data

### Data Flow
1. **Create**: Client form → Edge function → Insert `profiles` + optionally `client_pricing`
2. **Edit**: Load `client_pricing` → Show in form → Update on save
3. **Detail**: Load `client_pricing` → Display in Billing tab

### Database
Uses existing tables:
- `client_pricing` (client_id, pricing_model, base_fee, per_km_rate)
- `pricing_zones` (client_id, min_km, max_km, price)

## Acceptance Criteria

### Client Creation Form:
- [ ] Collapsible "Pricing Configuration" section after contact info
- [ ] Pricing model dropdown (per_km, flat_plus_km, zone)
- [ ] Base fee and per km rate inputs (for non-zone models)
- [ ] Zone configuration UI (for zone model)
- [ ] Pricing saved to `client_pricing` table when client is created
- [ ] Section is optional - client can be created without pricing
- [ ] Sensible defaults pre-filled (e.g., per_km model, €0 base, €0.50/km)

### Client Edit Form:
- [ ] Same pricing section as create form
- [ ] Pre-populated with existing pricing if configured
- [ ] Can update pricing model and rates
- [ ] Can add pricing if not previously configured

### Client Detail Page:
- [ ] New "Billing" tab alongside Info and Services
- [ ] Shows current pricing model and rates
- [ ] Shows "Not configured" if no pricing set
- [ ] "Edit Pricing" button that scrolls to edit form or opens modal
- [ ] Quick link to full billing history page

### Client Detail Dropdown Menu:
- [ ] "View Billing History" item linking to `/courier/billing/[client_id]`

### Shared Component:
- [ ] Create reusable `PricingConfigForm.svelte` component
- [ ] Used in both create and edit forms
- [ ] Handles all three pricing models
- [ ] Validates zone configuration

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | User reported poor UX | Pricing config completely disconnected from client management |
| 2026-01-22 | Analyzed current flow | 5+ clicks to configure pricing for new client |
| 2026-01-22 | Approved during triage | Status changed to ready - implement all 4 options together |

## Resources

- Client creation: `src/routes/courier/clients/+page.svelte`
- Client edit: `src/routes/courier/clients/[id]/edit/+page.svelte`
- Client detail: `src/routes/courier/clients/[id]/+page.svelte`
- Pricing config: `src/routes/courier/billing/[client_id]/+page.svelte`
- Database: `client_pricing` and `pricing_zones` tables
