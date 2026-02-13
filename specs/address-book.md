# Client Address Book Test Plan

## Overview
Tests for the Client Address Book feature: dedicated management page with CRUD, and inline picker on the new request form.

### Prerequisites
- Client account exists (test@example.com / 6Ee281414)
- Client is logged in
- Address book starts empty (tests run after reset)

---

### 1. Address Book CRUD
**Seed:** `e2e/seed.spec.ts`

#### 1.1 Empty state shows correct message
**Preconditions:** Client logged in, no saved addresses

**Steps:**
1. Navigate to `/en/client/address-book`
2. Observe the page content

**Expected Results:**
- Page title "Address Book" is visible
- Empty state message "No saved addresses yet" is visible
- "Add Address" button is visible

#### 1.2 Add a new address
**Preconditions:** Client logged in, on address book page

**Steps:**
1. Click "Add Address" button
2. Dialog opens with "Add Address" title
3. Fill label field with "Test Office"
4. Fill address field by typing "Rua Augusta 100, Lisboa" and selecting from autocomplete
5. Click "Save" button

**Expected Results:**
- Dialog closes
- Toast "Address saved" appears
- "Test Office" appears in the address list with the full address

#### 1.3 Add a second address
**Preconditions:** One address already exists

**Steps:**
1. Click "Add Address" button
2. Fill label with "Warehouse"
3. Fill address with "Avenida da Liberdade 1, Lisboa" and select from autocomplete
4. Click "Save"

**Expected Results:**
- Two addresses now visible in the list
- Both show label (bold) and address (muted)

#### 1.4 Edit an existing address
**Preconditions:** Addresses exist in list

**Steps:**
1. Click the pencil (edit) icon on "Test Office"
2. Dialog opens with "Edit Address" title, pre-filled with current values
3. Change label to "Main Office"
4. Click "Save"

**Expected Results:**
- Dialog closes
- Toast "Address updated" appears
- List shows "Main Office" instead of "Test Office"

#### 1.5 Delete an address
**Preconditions:** Multiple addresses exist

**Steps:**
1. Click the trash (delete) icon on "Warehouse"
2. Confirmation dialog appears with "Delete Address" title
3. Click "Delete" button

**Expected Results:**
- Dialog closes
- Toast "Address deleted" appears
- "Warehouse" is no longer in the list
- "Main Office" remains

#### 1.6 Search filters addresses
**Preconditions:** At least one address exists ("Main Office")

**Steps:**
1. Type "Main" in the search field
2. Wait for debounce (300ms)

**Expected Results:**
- "Main Office" is visible in results

3. Clear search and type "nonexistent"
4. Wait for debounce

**Expected Results:**
- "No addresses found" message is visible

---

### 2. Address Book Picker on New Request Form
**Seed:** `e2e/seed.spec.ts`

#### 2.1 Picker shows saved addresses
**Preconditions:** Client logged in, at least one saved address exists ("Main Office")

**Steps:**
1. Navigate to `/en/client/new`
2. Click the BookUser icon button next to "Pickup Location" label

**Expected Results:**
- Popover opens showing "Main Office" with its address

#### 2.2 Selecting an address fills the form field
**Preconditions:** Picker popover is open with saved addresses

**Steps:**
1. Click on "Main Office" in the popover

**Expected Results:**
- Popover closes
- Pickup location field is filled with the address from "Main Office"

#### 2.3 Save address from picker
**Preconditions:** Client on new request form, delivery field has an address typed

**Steps:**
1. Fill delivery field with "Rua do Ouro 50, Lisboa" and select from autocomplete
2. Click BookUser icon next to "Delivery Location"
3. Click "Save this address" link in popover
4. Type "Client Warehouse" in the label input
5. Click the save button

**Expected Results:**
- Toast "Address saved" appears
- New address appears in the popover list
