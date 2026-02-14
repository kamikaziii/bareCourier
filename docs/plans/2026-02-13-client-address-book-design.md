# Client Address Book

## Overview

Clients can save named addresses ("Address Book") so they don't have to retype addresses for recurring recipients when creating service requests. This is a personal convenience feature — fully private to each client, invisible to the courier.

## Data Model

New `client_addresses` table:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | `gen_random_uuid()` |
| client_id | uuid FK → profiles.id | Owning client |
| label | text NOT NULL | e.g. "John's Bakery" |
| address | text NOT NULL | Full address string |
| lat | float8 | Optional coordinates |
| lng | float8 | Optional coordinates |
| created_at | timestamptz | `now()` |

**RLS:** Client-only. `client_id = auth.uid()` for SELECT/INSERT/UPDATE/DELETE. No courier access.

## Navigation

Updated client nav order (bottom bar shows first 4):

1. My Services (Package)
2. New Request (PlusCircle)
3. Calendar (Calendar)
4. **Address Book (BookUser)** — new
5. Billing (Receipt) → overflow "More"
6. Settings (Settings) → overflow "More"

## Address Book Page (`/client/address-book`)

- Paginated list (20 per page) with Previous/Next controls
- Search input to filter by label or address text
- Each entry: label (bold) + address (muted, truncated)
- Add/Edit: Dialog with label text input + AddressInput (Mapbox autocomplete for coords)
- Delete: confirmation dialog
- Empty state: "No saved addresses yet. Save addresses to quickly fill them in when creating service requests."
- Sorted alphabetically by label

## Inline Picker on New Request Form (`/client/new`)

- Small BookUser icon button next to each address field label ("Pickup Location" / "Delivery Location")
- Opens a Popover with:
  - Searchable list of saved addresses (label + truncated address)
  - Max height with scroll for long lists
  - Selecting an entry fills the address field + sets coordinates (triggers existing `handlePickupSelect`/`handleDeliverySelect`)
- "Save current address" link at bottom of popover — visible only when field has a value
  - Prompts for a label, then creates a new `client_addresses` entry

## Not In Scope

- No recipient name/phone stored on contacts (address-only bookmarks)
- No courier visibility into client addresses
- No changes to existing auto-generated suggestion chips (they coexist independently)
