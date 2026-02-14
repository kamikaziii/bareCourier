# Client Address Book Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let clients save named addresses ("Address Book") for quick reuse when creating service requests.

**Architecture:** New `client_addresses` DB table with client-only RLS. Dedicated `/client/address-book` page with paginated CRUD. Inline popover picker on the `/client/new` form next to each address field. All strings localized in EN + PT-PT.

**Tech Stack:** SvelteKit, Svelte 5 runes, shadcn-svelte (Dialog, Popover, AlertDialog, Button, Input, Label, Card), Supabase (PostgreSQL + RLS), Tailwind CSS v4, Paraglide i18n

---

### Task 1: Database Migration + Types

**Files:**
- Create: `supabase/migrations/20260214000001_create_client_addresses.sql`
- Modify: `src/lib/database.types.ts`
- Modify: `src/lib/database.generated.ts` (regenerate)

**Step 1: Create migration file**

```sql
-- Create client_addresses table for client address book feature
CREATE TABLE client_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  address text NOT NULL,
  lat float8,
  lng float8,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by client
CREATE INDEX idx_client_addresses_client_id ON client_addresses(client_id);

-- Enable RLS
ALTER TABLE client_addresses ENABLE ROW LEVEL SECURITY;

-- Client-only policies: fully private, no courier access
DROP POLICY IF EXISTS client_addresses_select ON client_addresses;
CREATE POLICY client_addresses_select ON client_addresses
  FOR SELECT TO authenticated
  USING (client_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS client_addresses_insert ON client_addresses;
CREATE POLICY client_addresses_insert ON client_addresses
  FOR INSERT TO authenticated
  WITH CHECK (client_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS client_addresses_update ON client_addresses;
CREATE POLICY client_addresses_update ON client_addresses
  FOR UPDATE TO authenticated
  USING (client_id = (SELECT auth.uid()))
  WITH CHECK (client_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS client_addresses_delete ON client_addresses;
CREATE POLICY client_addresses_delete ON client_addresses
  FOR DELETE TO authenticated
  USING (client_id = (SELECT auth.uid()));
```

**Step 2: Push migration**

Run: `supabase db push`

**Step 3: Regenerate types**

Run: `pnpm run types:generate`

**Step 4: Add client_addresses to Database type override in `src/lib/database.types.ts`**

After the `service_reschedule_history` line (~line 239), add:
```typescript
client_addresses: GeneratedDatabase['public']['Tables']['client_addresses'];
```

Add convenience alias after the existing ones (~line 275):
```typescript
export type ClientAddress = Database['public']['Tables']['client_addresses']['Row'];
export type NewClientAddress = Database['public']['Tables']['client_addresses']['Insert'];
```

**Step 5: Verify types compile**

Run: `pnpm run check`

**Step 6: Commit**

```
feat: add client_addresses table with RLS
```

---

### Task 2: i18n Messages (EN + PT-PT)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add all needed message keys to `messages/en.json`**

Add these keys (find an appropriate location, e.g. near the `nav_*` keys and near the end for feature-specific keys):

```json
"nav_address_book": "Address Book",

"address_book_title": "Address Book",
"address_book_subtitle": "Save addresses you use frequently",
"address_book_empty": "No saved addresses yet",
"address_book_empty_desc": "Save addresses to quickly fill them in when creating service requests.",
"address_book_add": "Add Address",
"address_book_edit": "Edit Address",
"address_book_delete_title": "Delete Address",
"address_book_delete_desc": "Are you sure you want to delete this saved address? This action cannot be undone.",
"address_book_label": "Label",
"address_book_label_placeholder": "e.g. John's Bakery",
"address_book_address": "Address",
"address_book_search_placeholder": "Search addresses...",
"address_book_save_current": "Save this address",
"address_book_pick": "Pick from address book",
"address_book_no_results": "No addresses found",
"toast_address_saved": "Address saved",
"toast_address_updated": "Address updated",
"toast_address_deleted": "Address deleted"
```

**Step 2: Add corresponding PT-PT translations to `messages/pt-PT.json`**

```json
"nav_address_book": "Moradas",

"address_book_title": "Moradas",
"address_book_subtitle": "Guarde moradas que usa frequentemente",
"address_book_empty": "Sem moradas guardadas",
"address_book_empty_desc": "Guarde moradas para as preencher rapidamente ao criar pedidos de serviço.",
"address_book_add": "Adicionar Morada",
"address_book_edit": "Editar Morada",
"address_book_delete_title": "Apagar Morada",
"address_book_delete_desc": "Tem a certeza que deseja apagar esta morada guardada? Esta ação não pode ser desfeita.",
"address_book_label": "Nome",
"address_book_label_placeholder": "ex. Padaria do João",
"address_book_address": "Morada",
"address_book_search_placeholder": "Pesquisar moradas...",
"address_book_save_current": "Guardar esta morada",
"address_book_pick": "Escolher da lista de moradas",
"address_book_no_results": "Nenhuma morada encontrada",
"toast_address_saved": "Morada guardada",
"toast_address_updated": "Morada atualizada",
"toast_address_deleted": "Morada apagada"
```

**Step 3: Verify paraglide compiles**

Run: `pnpm run check`

**Step 4: Commit**

```
feat: add i18n messages for address book (EN + PT-PT)
```

---

### Task 3: Address Book Page — Server Load + Actions

**Files:**
- Create: `src/routes/client/address-book/+page.server.ts`

**Step 1: Create the server file with load function and CRUD actions**

The load function should:
- Validate session (redirect to `/login` if not authenticated)
- Accept `search` and `page` URL params
- Query `client_addresses` filtered by `client_id = user.id`
- If `search` param exists, filter with `.or(`label.ilike.%${search}%,address.ilike.%${search}%`)`
- Order by `label` ascending
- Paginate: `.range(offset, offset + PAGE_SIZE - 1)` with `PAGE_SIZE = 20`
- Return `{ addresses, totalCount, page, search }`

Use `supabase.from('client_addresses').select('*', { count: 'exact' })` to get total count for pagination.

Actions:
- `create`: Insert new address (label + address + lat + lng). Validate label and address are non-empty.
- `update`: Update by id. Validate label and address are non-empty. Ensure the address belongs to the user by filtering on `client_id`.
- `delete`: Delete by id. Filter on `client_id` for safety.

Follow the pattern from `src/routes/client/settings/+page.server.ts` for session validation and error handling.

**Step 2: Verify types compile**

Run: `pnpm run check`

**Step 3: Commit**

```
feat: add address book server load + CRUD actions
```

---

### Task 4: Address Book Page — UI

**Files:**
- Create: `src/routes/client/address-book/+page.svelte`

**Step 1: Create the page component**

Structure:
- Header row: `BookUser` icon + title `m.address_book_title()` + subtitle, with an "Add Address" `Button` on the right
- Search input below header: `Input` with `m.address_book_search_placeholder()`, debounced (300ms) — updates URL `?search=` param via `goto()`
- Address list: iterate `data.addresses`, each in a compact `Card.Root` showing:
  - Label (bold, `text-sm font-medium`)
  - Address (truncated, `text-sm text-muted-foreground`)
  - Action buttons on the right: Edit (Pencil icon) and Delete (Trash2 icon), small `variant="ghost" size="icon"`
- Empty state: when `data.addresses.length === 0` and no search, show `m.address_book_empty()` + `m.address_book_empty_desc()`
- Empty search state: when search active but no results, show `m.address_book_no_results()`
- Pagination: Previous/Next buttons at the bottom, disabled when at first/last page. Show "Page X of Y".

Dialogs:
- **Add/Edit Dialog** (`Dialog` component): Opens when clicking "Add Address" or Edit button. Contains:
  - `Label` + `Input` for the label field (`m.address_book_label()`)
  - `Label` + `AddressInput` for the address field (reuses Mapbox autocomplete, captures coords)
  - Hidden inputs for lat/lng
  - Save button submits a `form` with `method="POST"` and `action="?/create"` or `action="?/update"` (use `enhance`)
  - For edit: pre-fill values, include hidden `id` input
- **Delete AlertDialog**: Confirmation dialog using the existing pattern from `ToggleActiveDialog.svelte`. POST to `?/delete` with the address `id`.

Use Svelte 5 runes: `$state` for dialog open states, editing address, search term. `$derived` for pagination math.

**Step 2: Verify it renders**

Run: `pnpm run dev` and navigate to `/client/address-book`

**Step 3: Commit**

```
feat: add address book page with CRUD and pagination
```

---

### Task 5: Update Client Navigation

**Files:**
- Modify: `src/routes/client/+layout.svelte` (~line 6 and ~lines 11-17)

**Step 1: Add BookUser import and nav item**

Add `BookUser` to the lucide import:
```typescript
import { Package, PlusCircle, Calendar, BookUser, Receipt, Settings } from '@lucide/svelte';
```

Insert the Address Book nav item at position 4 (after Calendar, before Billing):
```typescript
const allNavItems: NavItem[] = $derived([
  { href: '/client', label: m.nav_my_services(), icon: Package, badge: data.navCounts?.suggestedServices },
  { href: '/client/new', label: m.nav_new_request(), icon: PlusCircle },
  { href: '/client/calendar', label: m.nav_calendar(), icon: Calendar },
  { href: '/client/address-book', label: m.nav_address_book(), icon: BookUser },
  { href: '/client/billing', label: m.nav_billing(), icon: Receipt },
  { href: '/client/settings', label: m.nav_settings(), icon: Settings }
]);
```

Bottom bar still shows first 4, so Address Book gets the 4th spot. Billing and Settings move to "More" overflow.

**Step 2: Verify navigation renders correctly**

Run: `pnpm run dev`, check both desktop sidebar and mobile bottom bar.

**Step 3: Commit**

```
feat: add Address Book to client navigation
```

---

### Task 6: Inline Address Book Popover on New Request Form

**Files:**
- Create: `src/lib/components/AddressBookPicker.svelte`
- Modify: `src/routes/client/new/+page.svelte`
- Modify: `src/routes/client/new/+page.ts`

**Step 1: Create `AddressBookPicker.svelte` component**

Props interface:
```typescript
interface Props {
  supabase: SupabaseClient;
  onSelect: (address: string, coords: [number, number] | null) => void;
  currentAddress?: string; // Current value of the address field, for "save" feature
  onSave?: (label: string, address: string, coords: [number, number] | null) => void; // Callback after saving
  disabled?: boolean;
}
```

Structure:
- A `Popover` with a `BookUser` icon button as trigger (small, `variant="ghost"`, `size="icon"`, next to the Label)
- Popover content:
  - Search `Input` at top (filters client-side from loaded list)
  - Scrollable list (`max-h-60 overflow-y-auto`) of saved addresses
  - Each item: button showing label (bold) + address (muted, truncated). On click, calls `onSelect(address, coords)` and closes popover.
  - If `currentAddress` is non-empty, show a "Save this address" link at the bottom. Clicking it opens a small inline input for the label, then calls the save endpoint.
  - If no addresses and no currentAddress: show `m.address_book_empty()` with a link to `/client/address-book`
  - If search has no results: show `m.address_book_no_results()`

The component loads addresses on mount via `supabase.from('client_addresses').select('*').order('label')`. No server-side pagination needed here — load all for fast client-side filtering (a client won't have thousands).

For the "Save this address" flow:
- Show an Input for the label
- On submit, `supabase.from('client_addresses').insert({ client_id: user.id, label, address, lat, lng })` — but since we don't have the user ID in the component, use the Supabase client which RLS will scope automatically. Actually, the `client_id` column needs to be set. Get it from the session or pass it as a prop.
- Alternative: POST to `/client/address-book?/create` via fetch (reuses server action). This is cleaner.
- After save, refresh the local list and show toast.

**Step 2: Update `src/routes/client/new/+page.ts` to pass saved addresses**

Add a query to load `client_addresses` in the `load` function:
```typescript
const clientAddressesResult = profile?.id
  ? supabase
      .from('client_addresses')
      .select('*')
      .order('label')
  : Promise.resolve(null);
```

Add to the parallel `Promise.all` and return `savedAddresses` in the load data.

**Step 3: Update `src/routes/client/new/+page.svelte` to add the picker**

For each address field (pickup and delivery), add the `AddressBookPicker` next to the `Label`:

```svelte
<div class="flex items-center justify-between">
  <Label for="pickup">{m.form_pickup_location()}</Label>
  <AddressBookPicker
    addresses={data.savedAddresses}
    onSelect={(address, coords) => handlePickupSelect(address, coords)}
    currentAddress={pickupLocation}
    currentCoords={pickupCoords}
    supabase={data.supabase}
  />
</div>
```

Same pattern for the delivery field with `handleDeliverySelect`.

**Step 4: Verify it works end-to-end**

Run: `pnpm run dev`, create an address via the address book page, then go to New Request and verify the popover shows and fills the field.

**Step 5: Commit**

```
feat: add inline address book picker to new request form
```

---

### Task 7: Final Verification

**Step 1: Run type check**

Run: `pnpm run check`
Expected: No errors

**Step 2: Run lint**

Run: `pnpm run lint`
Expected: No errors (fix any if found)

**Step 3: Run build**

Run: `pnpm run build`
Expected: Successful build

**Step 4: Manual smoke test**

1. Log in as client
2. Navigate to Address Book — should be empty
3. Add 2-3 addresses with labels
4. Verify they appear in the list, edit one, delete one
5. Go to New Request
6. Click the BookUser icon next to Pickup — popover should show saved addresses
7. Select one — address field fills, coords set, map updates
8. Type a new address in Delivery, click BookUser icon, use "Save this address"
9. Verify the saved address now appears in the popover

**Step 5: Commit any fixes, then final commit if needed**

```
chore: final cleanup for address book feature
```
