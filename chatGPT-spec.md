# Simple Courier Service Management System

## Functional Specification

### Project Status

Initial MVP – Solo courier operation (single admin)

### Target Users

- Solo courier / shipper (admin)
- Dental lab clients (external users)

### Project Goal

Replace paper notes and manual organization with a simple, mobile-first system that allows:

- Clients to request pickups and deliveries
- Courier to track service status
- Easy monthly service summaries for invoicing

This system prioritizes **simplicity, speed, and reliability** over advanced features.

---

## 1. User Roles

### 1.1 Courier (Admin)

- Single internal user
- Full access to all data
- Responsible for service execution and billing

### 1.2 Client (Dental Lab)

- External users
- Can only view and create their own services
- No access to other clients or billing logic

---

## 2. Core Entities

### 2.1 Client

Represents a dental lab.

**Fields:**

- Client ID
- Name
- Email (optional)
- Phone number (optional)
- Active status (active / inactive)
- Created at

---

### 2.2 Service (Order / Job)

Represents a pickup + delivery request.

**Fields:**

- Service ID
- Client ID
- Pickup location
- Delivery location
- Status
- Optional notes
- Created at
- Delivered at (nullable)

---

## 3. Service Status

Service status is intentionally minimal.

| Status   | Meaning                          |
| -------- | -------------------------------- |
| 🔵 Blue  | Service created, awaiting pickup |
| 🟢 Green | Service delivered                |

Status changes are **manual** and performed by the courier.

---

## 4. Courier (Admin) Features

### 4.1 Dashboard (Daily View)

The main operational screen.

**Requirements:**

- List of services for the current day
- Visual status indicator (Blue / Green)
- Client name
- Pickup → Delivery locations
- Creation time

**Optional:**

- Filter by date (Today / Tomorrow / All)
- Counters (e.g. “5 pending, 12 delivered today”)

---

### 4.2 Service Management

**Courier can:**

- View all services
- Filter services by:
  - Client
  - Date
  - Status
- Change service status from Blue → Green
- Add or edit internal notes

**Restrictions:**

- Delivered services should not be deleted
- Editing after delivery should be limited or disabled

---

### 4.3 Client Management

**Courier can:**

- Create client accounts
- Activate / deactivate clients
- View all services related to a client

**Courier cannot:**

- Impersonate client actions (optional)

---

### 4.4 Monthly Overview (Billing Support)

**Purpose:**
Support manual invoicing by providing service summaries.

**Requirements:**

- Filter services by:
  - Client
  - Date range (e.g. month)
  - Delivered status only
- Display:
  - Total number of services
  - List of delivered services

**Export options:**

- PDF
- CSV
- Excel

No pricing logic is included in the system.

---

## 5. Client Features

### 5.1 Authentication

- Simple login
- Persistent session (“stay logged in”)
- No complex password rules

---

### 5.2 Create Service

**Client can:**

- Create a new service using a simple form

**Form fields:**

- Pickup location (pre-filled with client lab)
- Delivery location
- Optional note

**Behavior:**

- New service is created with status 🔵 Blue
- Client cannot edit service after creation

---

### 5.3 Service List

**Client can view:**

- All their services
- Status indicator
- Creation date

**Client cannot:**

- Modify status
- Delete services
- View other clients’ services

---

## 6. Non-Functional Requirements

### 6.1 Usability

- Mobile-first design
- Optimized for one-handed use
- Minimal screens and clicks

---

### 6.2 Performance

- Fast load times
- Works well on low-end devices

---

### 6.3 Data Safety

- Prevent accidental deletions
- Basic validation on forms
- No silent data loss

---

## 7. Out of Scope (Explicitly Excluded)

- Accounting and payments
- Route optimization
- Employee management
- Pricing logic
- GPS tracking
- Multi-language support (initially)

---

## 8. Future Enhancements (Optional Phase 2)

### Courier-side

- Map view of daily services
- Pickup and delivery timestamps
- Photo proof of delivery

### Client-side

- Delivery notifications (email or WhatsApp)
- Service history search

---

## 9. Guiding Principle

This system is designed to be:

> “A shared digital clipboard between a courier and dental labs”

If a feature adds complexity without reducing daily workload, it should not be implemented.

---
