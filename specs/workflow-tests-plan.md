# bareCourier Workflow Tests Plan

## Overview

These tests simulate real-world usage of bareCourier starting from a **fresh account with zero data**. The courier uses **type-based pricing** as the primary pricing model.

## Test Execution Order

Tests must run sequentially - each depends on data created by previous tests.

```
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10
```

---

## Phase 1: Courier Onboarding (`01-courier-onboarding.spec.ts`)

**Seed:** `courier seed`

**Preconditions:** Fresh courier account, no configuration done

### 1.1 Account Setup
**Steps:**
1. Navigate to /courier/settings
2. Verify Account tab is active
3. Fill in courier name
4. Fill in phone number
5. Select timezone
6. Save changes

**Expected Results:**
- Success toast displayed
- Profile updated

### 1.2 Select Type-Based Pricing Model
**Steps:**
1. Click Pricing tab
2. Select "Type-based" pricing mode
3. Save changes

**Expected Results:**
- Pricing mode saved
- Service Types section becomes available

### 1.3 Create Service Types
**Steps:**
1. In Pricing tab, find Service Types section
2. Click "Add Service Type"
3. Create "Standard Delivery" with price €5.00
4. Create "Express Delivery" with price €10.00
5. Create "Same Day" with price €15.00

**Expected Results:**
- Three service types appear in list
- Each shows name and price

### 1.4 Create Distribution Zones
**Steps:**
1. Navigate to Distribution Zones section
2. Click "Add Zone"
3. Create zone "City Center"
4. Add municipalities to zone
5. Create zone "Suburbs"
6. Add municipalities

**Expected Results:**
- Two zones created
- Municipalities assigned to each

### 1.5 Configure VAT
**Steps:**
1. In Pricing tab, find VAT section
2. Enable VAT
3. Set rate to 23%
4. Select display option (inclusive/exclusive)
5. Save

**Expected Results:**
- VAT enabled
- Rate saved

### 1.6 Configure Time Slots
**Steps:**
1. Click Scheduling tab
2. Set morning slot (08:00-12:00)
3. Set afternoon slot (12:00-17:00)
4. Set evening slot (17:00-20:00)
5. Select working days (Mon-Fri)
6. Save

**Expected Results:**
- Time slots configured
- Working days saved

### 1.7 Configure Notifications
**Steps:**
1. Click Notifications tab
2. Enable in-app notifications for all categories
3. Save preferences

**Expected Results:**
- Notification preferences saved

---

## Phase 2: First Client Creation (`02-first-client-creation.spec.ts`)

**Seed:** `courier seed`

**Preconditions:** Phase 1 complete (service types exist)

### 2.1 Navigate to Clients
**Steps:**
1. Click "Clients" in navigation
2. Verify empty state or client list

**Expected Results:**
- Clients page loads
- "Create Client" button visible

### 2.2 Create First Client
**Steps:**
1. Click "Create Client" / "New Client" button
2. Fill in client name: "Test Business"
3. Fill in phone: "+351 912 345 678"
4. Fill in default pickup location (use address input)
5. Select default service type: "Standard Delivery"
6. Submit form

**Expected Results:**
- Client created successfully
- Redirected to clients list
- New client appears with name, phone, and type

### 2.3 Verify Client Details
**Steps:**
1. Click on created client
2. Verify client details page shows all info

**Expected Results:**
- Client name displayed
- Phone displayed
- Default pickup location displayed
- Service type displayed

---

## Phase 3: Courier Creates First Service (`03-courier-creates-service.spec.ts`)

**Seed:** `courier seed`

**Preconditions:** Phase 2 complete (client exists)

### 3.1 Navigate to Create Service
**Steps:**
1. Navigate to /courier/services/new
2. Or click "New Service" from dashboard

**Expected Results:**
- Service creation form loads

### 3.2 Fill Service Form
**Steps:**
1. Select client "Test Business" from dropdown
2. Verify pickup location auto-fills from client default
3. Enter delivery address (in-zone address)
4. Wait for zone detection
5. Verify service type shows (from client default or select)
6. See price preview displayed
7. Select schedule date (tomorrow)
8. Select time slot (morning)
9. Add optional notes

**Expected Results:**
- Client selection works
- Pickup auto-fills
- Zone detected correctly
- Price preview shows calculated amount
- Form is valid

### 3.3 Submit and Verify
**Steps:**
1. Click "Create Service" button
2. Wait for redirect

**Expected Results:**
- Service created
- Redirected to dashboard or services list
- New service appears with "pending" status (blue)
- Service shows correct price

---

## Phase 4: Client First Request (`04-client-first-request.spec.ts`)

**Seed:** `client seed`

**Preconditions:** Phase 1 complete (pricing configured)

### 4.1 Client Dashboard (Empty State)
**Steps:**
1. Login as client
2. View dashboard

**Expected Results:**
- Dashboard loads
- Empty state or "no services" message
- "Create Request" button visible

### 4.2 Create Service Request
**Steps:**
1. Click "New Request" / "Create Request"
2. Enter pickup address
3. Enter delivery address (in-zone)
4. Wait for zone detection
5. Select service type
6. View price estimate
7. Optionally set time preference
8. Add notes
9. Submit request

**Expected Results:**
- Form validates
- Price estimate displayed (if show_price_to_client enabled)
- Request submitted successfully

### 4.3 Verify Request in Dashboard
**Steps:**
1. Return to dashboard
2. Find new request

**Expected Results:**
- Request appears with "pending" request status
- Shows pickup/delivery locations
- Shows "awaiting response" or similar

---

## Phase 5: Request Acceptance (`05-request-acceptance.spec.ts`)

**Seed:** `courier seed`

**Preconditions:** Phase 4 complete (pending request exists)

### 5.1 View Pending Requests
**Steps:**
1. Navigate to /courier/requests
2. View pending requests list

**Expected Results:**
- Client's request visible
- Shows workload capacity info
- Accept/Suggest/Reject buttons visible

### 5.2 Accept Request
**Steps:**
1. Click "Accept" on the request
2. Confirm in dialog (if any)

**Expected Results:**
- Request status changes to "accepted"
- Service becomes scheduled
- Workload updates

### 5.3 Verify Client Sees Acceptance
**Steps:**
1. Switch to client account
2. View dashboard

**Expected Results:**
- Service shows "accepted" / "scheduled" status
- Scheduled date/time visible

---

## Phase 6: Request Negotiation (`06-request-negotiation.spec.ts`)

**Seed:** `courier seed` then `client seed`

**Preconditions:** New pending request exists

### 6.1 Courier Suggests Alternative
**Steps:**
1. Login as courier
2. Go to /courier/requests
3. Find pending request
4. Click "Suggest"
5. Select alternative date
6. Select time slot
7. Submit suggestion

**Expected Results:**
- Request status changes to "suggested"
- Suggested date/time saved

### 6.2 Client Responds to Suggestion
**Steps:**
1. Login as client
2. View dashboard "Needs Attention" section
3. See suggestion notification
4. Click to view details
5. Accept OR Decline suggestion

**Expected Results (Accept):**
- Service becomes scheduled with suggested date
- Status changes to "accepted"

**Expected Results (Decline):**
- Service returns to "pending"
- Courier sees it needs re-handling

---

## Phase 7: Service Delivery (`07-service-delivery.spec.ts`)

**Seed:** `courier seed`

**Preconditions:** Scheduled service exists

### 7.1 Mark Service Delivered
**Steps:**
1. Go to courier dashboard
2. Find scheduled service (pending status, blue)
3. Click status toggle or "Mark Delivered"

**Expected Results:**
- Status changes to "delivered" (green)
- delivered_at timestamp set
- Optimistic UI update

### 7.2 Verify Client Sees Delivery
**Steps:**
1. Login as client
2. View dashboard

**Expected Results:**
- Service shows "delivered" status (green)

---

## Phase 8: Reschedule Flow (`08-reschedule-flow.spec.ts`)

**Seed:** `client seed` then `courier seed`

**Preconditions:** Accepted/scheduled service exists

### 8.1 Client Requests Reschedule
**Steps:**
1. Login as client
2. View service details
3. Click "Reschedule" button
4. Select new date
5. Select reason
6. Submit request

**Expected Results:**
- Reschedule request submitted
- pending_reschedule_date set
- Service shows "reschedule pending" indicator

### 8.2 Courier Approves Reschedule
**Steps:**
1. Login as courier
2. Go to /courier/requests
3. Find "Pending Reschedules" section
4. Review reschedule request
5. Click "Approve"

**Expected Results:**
- scheduled_date updated to new date
- pending_reschedule cleared
- History recorded

---

## Phase 9: Billing Verification (`09-billing-verification.spec.ts`)

**Seed:** `courier seed`

**Preconditions:** Delivered services exist

### 9.1 View Billing Page
**Steps:**
1. Navigate to /courier/billing
2. Set date range to include delivered services

**Expected Results:**
- Billing page loads
- Summary cards show: total services, total km, revenue

### 9.2 View Client Breakdown
**Steps:**
1. Find client in billing table
2. View pricing breakdown

**Expected Results:**
- Client listed with service count
- Revenue per client shown
- VAT breakdown visible (if enabled)

### 9.3 Export CSV
**Steps:**
1. Click "Export CSV" button
2. Verify download

**Expected Results:**
- CSV file downloads
- Contains service data with prices

---

## Phase 10: Out-of-Zone Scenario (`10-out-of-zone-scenario.spec.ts`)

**Seed:** `courier seed`

**Preconditions:** Distribution zones configured

### 10.1 Create Out-of-Zone Service
**Steps:**
1. Go to create service form
2. Select client
3. Enter delivery address OUTSIDE configured zones
4. Wait for zone detection

**Expected Results:**
- "Out of zone" indicator appears
- Out-of-zone surcharge added to price
- Tolls input field appears

### 10.2 Add Tolls
**Steps:**
1. Enter tolls amount (e.g., €2.50)
2. Verify price updates

**Expected Results:**
- Price includes tolls
- Breakdown shows: base + out-of-zone + tolls

### 10.3 Complete Out-of-Zone Service
**Steps:**
1. Submit service
2. Verify in billing

**Expected Results:**
- Service created with correct pricing
- Billing reflects out-of-zone charges

---

## Phase 11: Workload-Informed Request Handling (`11-workload-informed-requests.spec.ts`)

**Seed:** `courier seed` + `client seed`

**Preconditions:** Courier has workload settings configured, multiple pending requests exist

### 11.1 Setup: Create Multiple Requests for Same Day
**Steps:**
1. Login as client
2. Create 3-4 service requests for the same date
3. Each with different delivery addresses

**Expected Results:**
- Multiple pending requests created for same day

### 11.2 View Workload Badges on Request Cards
**Steps:**
1. Login as courier
2. Navigate to /courier/requests
3. Observe workload badges on each card

**Expected Results:**
- Each card shows workload badge (status icon + label)
- Badge color reflects workload status (green/yellow/red)
- Cards for same date show same workload status

### 11.3 Accept Dialog Shows Workload Summary
**Steps:**
1. Click "Accept" on a request
2. View the accept dialog

**Expected Results:**
- Expandable workload summary visible
- Shows time breakdown (driving, service, breaks, total)
- Shows buffer status
- Can expand/collapse for details

### 11.4 Suggest Dialog Shows Next Compatible Day
**Steps:**
1. Cancel accept dialog
2. Click "Suggest" on request for a busy day
3. View suggest dialog

**Expected Results:**
- Shows workload for originally requested date
- Shows "Next compatible day" suggestion (if current day is busy)
- "Use this date" button visible

### 11.5 Auto-Fill Next Compatible Day
**Steps:**
1. In suggest dialog, click "Use this date" button
2. Observe date picker

**Expected Results:**
- Date picker auto-fills with suggested date
- Workload indicator updates for new date

### 11.6 Workload Updates After Accepting
**Steps:**
1. Accept one of the requests
2. Return to requests list
3. Check workload badges for remaining requests

**Expected Results:**
- Workload badges update to reflect new load
- Status may change from green → yellow → red

---

## Phase 12: Batch Operations (`12-batch-operations.spec.ts`)

**Seed:** `courier seed` + `client seed`

**Preconditions:** Multiple pending requests/services exist

### 12.1 Batch Accept Requests
**Steps:**
1. Login as courier
2. Go to /courier/requests
3. Enable batch selection mode
4. Select multiple requests
5. Click "Accept Selected"

**Expected Results:**
- All selected requests accepted
- Services become scheduled
- Selection cleared

### 12.2 Batch Reschedule Services (Courier)
**Steps:**
1. Go to courier dashboard
2. Enable batch selection mode
3. Select multiple pending services
4. Click "Reschedule Selected"
5. Pick new date
6. Confirm

**Expected Results:**
- All selected services rescheduled
- New dates applied

### 12.3 Client Batch Accept Suggestions
**Steps:**
1. Login as client (with multiple suggestions pending)
2. Go to dashboard "Needs Attention" section
3. Enable batch selection
4. Select multiple suggestions
5. Click "Accept All"

**Expected Results:**
- All suggestions accepted
- Services scheduled with suggested dates

### 12.4 Client Batch Decline Suggestions
**Steps:**
1. Login as client (with multiple suggestions pending)
2. Select suggestions to decline
3. Click "Decline Selected"

**Expected Results:**
- Suggestions declined
- Services return to pending status

---

## Phase 13: Calendar Navigation (`13-calendar-navigation.spec.ts`)

**Seed:** `courier seed`

**Preconditions:** Services exist across multiple dates

### 13.1 View Calendar with Service Indicators
**Steps:**
1. Navigate to /courier/calendar
2. View current month

**Expected Results:**
- Days with services show indicator dots
- Blue dots for pending, green for delivered
- Multiple services show count

### 13.2 Navigate Between Months
**Steps:**
1. Click "Previous" to go back a month
2. Click "Next" to go forward
3. Click "Today" to return to current date

**Expected Results:**
- Calendar updates correctly
- Today button returns to current month

### 13.3 Select Day and View Services
**Steps:**
1. Click on a day with services
2. View side panel

**Expected Results:**
- Side panel shows list of services for that day
- Services show client, locations, status
- Can click to navigate to service detail

### 13.4 Client Calendar View
**Steps:**
1. Login as client
2. Navigate to /client/calendar
3. Repeat navigation and selection tests

**Expected Results:**
- Client sees only their own services
- Same calendar functionality

---

## Phase 14: Past Due Handling (`14-past-due-handling.spec.ts`)

**Seed:** `courier seed`

**Preconditions:** Courier has past due settings configured, services with past scheduled dates

### 14.1 View Past Due Services
**Steps:**
1. Ensure a service has scheduled_date in the past (not delivered)
2. Go to courier dashboard
3. Look for past due indicators

**Expected Results:**
- Past due services highlighted
- Status shows approaching/urgent/critical based on age

### 14.2 Past Due in Billing
**Steps:**
1. Go to /courier/billing
2. Filter to include past due period

**Expected Results:**
- Past due services included in billing
- Can identify undelivered services

---

## Phase 15: Notification Flow (`15-notification-flow.spec.ts`)

**Seed:** `client seed` then `courier seed`

**Preconditions:** Notification preferences enabled

### 15.1 Client Creates Request - Courier Gets Notification
**Steps:**
1. Login as client
2. Create new service request
3. Login as courier
4. Check notification bell

**Expected Results:**
- Notification bell shows unread count
- Dropdown shows new request notification
- Can click to navigate to requests

### 15.2 Courier Accepts - Client Gets Notification
**Steps:**
1. Courier accepts the request
2. Login as client
3. Check notification bell

**Expected Results:**
- Client sees acceptance notification
- Can click to view service details

### 15.3 Mark Notifications as Read
**Steps:**
1. Click on notification
2. Or click "Mark all as read"

**Expected Results:**
- Notification marked as read
- Unread count decreases

### 15.4 Filter Notifications by Category
**Steps:**
1. Open notification dropdown
2. Filter by category (if available)

**Expected Results:**
- Only notifications of selected category shown

---

## Phase 16: Edit and Delete Scenarios (`16-edit-delete-scenarios.spec.ts`)

**Seed:** `courier seed`

**Preconditions:** Services exist in various states

### 16.1 Edit Pending Service
**Steps:**
1. Navigate to pending service detail
2. Click "Edit"
3. Change delivery address
4. Change notes
5. Save

**Expected Results:**
- Service updated
- Changes reflected in detail view

### 16.2 Delete Pending Service
**Steps:**
1. Navigate to pending service detail
2. Click "Delete"
3. Confirm deletion

**Expected Results:**
- Service soft-deleted (deleted_at set)
- Removed from lists
- Not shown in dashboard

### 16.3 Client Cancels Pending Request
**Steps:**
1. Login as client
2. View pending request in dashboard
3. Click "Cancel Request"
4. Confirm

**Expected Results:**
- Request cancelled/deleted
- Removed from client dashboard
- Removed from courier requests

### 16.4 Cannot Edit Delivered Service
**Steps:**
1. Navigate to delivered service
2. Check for edit option

**Expected Results:**
- Edit button disabled or hidden
- Cannot modify delivered services

---

## Phase 17: Multi-Client Management (`17-multi-client-management.spec.ts`)

**Seed:** `courier seed`

**Preconditions:** Phase 2 complete (at least one client exists)

### 17.1 Create Second Client
**Steps:**
1. Go to /courier/clients/new
2. Create "Second Business" with different service type
3. Set different default pickup location

**Expected Results:**
- Second client created
- Different service type assigned

### 17.2 Create Services for Different Clients
**Steps:**
1. Create service for first client
2. Create service for second client
3. View dashboard

**Expected Results:**
- Both services visible
- Can distinguish by client name

### 17.3 Filter by Client (if available)
**Steps:**
1. Use client filter on services list
2. Select specific client

**Expected Results:**
- Only that client's services shown

### 17.4 Billing Shows Per-Client Breakdown
**Steps:**
1. Go to /courier/billing
2. View client breakdown table

**Expected Results:**
- Both clients listed
- Revenue calculated separately
- Different pricing based on service types

---

## Phase 18: Client Advanced Filtering (`18-client-advanced-filtering.spec.ts`)

**Seed:** `client seed`

**Preconditions:** Client has multiple services in various states

### 18.1 Filter by Status
**Steps:**
1. Login as client
2. Use status filter (pending/delivered/all)

**Expected Results:**
- List filters correctly
- Count updates

### 18.2 Filter by Date Range
**Steps:**
1. Open advanced filters
2. Set date range
3. Apply

**Expected Results:**
- Only services within date range shown

### 18.3 Search by Location
**Steps:**
1. Use location search input
2. Type part of address

**Expected Results:**
- Services matching location shown

### 18.4 Sort Options
**Steps:**
1. Use sort dropdown
2. Try: newest, oldest, pending-first, delivered-first

**Expected Results:**
- List reorders correctly for each option

### 18.5 Pagination
**Steps:**
1. If many services, navigate pages
2. Use next/previous

**Expected Results:**
- Pages navigate correctly
- Filters persist across pages

---

## Phase 19: Time Preference Pricing (`19-time-preference-pricing.spec.ts`)

**Seed:** `client seed`

**Preconditions:** Type-based pricing with time preference enabled

### 19.1 Select Time Preference
**Steps:**
1. Create new service request
2. Select service type
3. Enable time preference option
4. Select specific time slot

**Expected Results:**
- Price preview updates (if time adds cost)
- Time preference saved with request

### 19.2 Verify Time Preference in Request
**Steps:**
1. Login as courier
2. View request with time preference

**Expected Results:**
- Time preference visible on request
- Price reflects time-based adjustment

---

## Phase 20: Rejection and Resubmit Flow (`20-rejection-resubmit-flow.spec.ts`)

**Seed:** `courier seed` + `client seed`

### 20.1 Courier Rejects Request
**Steps:**
1. Client creates request
2. Courier goes to /requests
3. Click "Reject" on request
4. Select rejection reason
5. Add optional comment
6. Confirm

**Expected Results:**
- Request marked as rejected
- Rejection reason saved

### 20.2 Client Sees Rejection
**Steps:**
1. Login as client
2. View dashboard "Needs Attention"

**Expected Results:**
- Rejected request shown
- Rejection reason visible
- Option to modify and resubmit

### 20.3 Client Resubmits
**Steps:**
1. Edit rejected request
2. Change date/details based on rejection reason
3. Resubmit

**Expected Results:**
- Request resubmitted as new pending request
- Courier sees updated request

---

## Test Data Requirements

| Entity | Values |
|--------|--------|
| Courier Email | garridoinformaticasupport@gmail.com |
| Courier Password | 6Ee281414 |
| Client Email | test@example.com |
| Client Password | 6Ee281414 |
| In-Zone Address | (to be determined based on zone config) |
| Out-of-Zone Address | (to be determined based on zone config) |
| Service Types | Standard (€5), Express (€10), Same Day (€15) |

---

## Notes

- All tests assume type-based pricing model
- Tests run sequentially due to data dependencies
- Use `{ exact: true }` for button selectors to avoid ambiguity
- Handle PWA update prompts if they appear
- Some tests require switching between courier and client accounts
