# Admin Panel Design

## Overview

A super admin dashboard for the developer to provide support to the courier/owner. Enables data fixes, troubleshooting via user impersonation, proactive monitoring, and future system configuration.

## Goals

- **Data fixes**: Read all data, targeted edits on specific fields
- **Troubleshooting**: Full user impersonation to reproduce bugs
- **Proactive monitoring**: Activity dashboard, anomaly alerts, audit log
- **System configuration** (Phase 2): Feature flags, system limits

## Non-Goals

- Multi-tenant admin (this is for a single admin/developer)
- Real-time analytics or complex dashboards
- Customer-facing support tickets or chat

---

## Architecture

### New Role: `admin`

Add `'admin'` to the profiles role constraint. Admins can do everything couriers can, plus admin-specific features.

### Route Structure

```
/admin                    # Activity dashboard (landing page)
/admin/users              # Browse all profiles
/admin/users/[id]         # User detail + impersonation
/admin/services           # Browse all services
/admin/services/[id]      # Service detail + edits
/admin/audit              # Audit log viewer
/admin/config             # Feature flags + system limits (Phase 2)
```

### Auth Guard

Same pattern as `/courier` and `/client`:

```typescript
// src/routes/admin/+layout.server.ts
export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
  const { session, user } = await safeGetSession();

  if (!session || !user) {
    redirect(303, '/login');
  }

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const profile = data as Profile | null;

  if (!profile || profile.role !== 'admin') {
    redirect(303, '/');
  }

  return { profile };
};
```

---

## Database Changes

### Schema Updates

```sql
-- Update profiles role constraint
ALTER TABLE profiles
DROP CONSTRAINT profiles_role_check,
ADD CONSTRAINT profiles_role_check CHECK (role IN ('courier', 'client', 'admin'));
```

### New Tables

```sql
-- Audit log for admin actions
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES profiles(id) NOT NULL,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_target ON audit_log(target_table, target_id);

-- Feature flags (Phase 2, create table now)
CREATE TABLE feature_flags (
  key text PRIMARY KEY,
  enabled boolean DEFAULT false,
  description text,
  updated_at timestamptz DEFAULT now()
);
```

### RLS Policies

```sql
-- Audit log: Admin read/insert only
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- Feature flags: Admin read/update
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_flags_select ON feature_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

CREATE POLICY feature_flags_update ON feature_flags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );
```

---

## Features

### 1. Activity Dashboard (`/admin`)

The admin landing page - quick health check at a glance.

**Components:**
- **Today's Stats**: Services created, delivered, pending requests
- **Recent Activity Feed**: Last 20 actions (service created, status changed, logins)
- **Alerts Panel**: Anomalies detected
- **Quick Links**: Jump to users, services, audit log

**Data Sources:**
- Stats: Aggregated queries on `services` table
- Activity: Recent entries from `services` + `audit_log`
- Alerts: Computed from rules (see Anomaly Alerts)

### 2. Users Browser (`/admin/users`)

Searchable, filterable table of all profiles.

**Columns:**
- Name
- Email (from auth.users join)
- Role (courier/client/admin)
- Status (active/inactive)
- Created
- Last Login

**Filters:**
- By role
- By active status

**Actions:**
- Click row → User detail page

### 3. User Detail (`/admin/users/[id]`)

Full profile information with edit capabilities.

**Read-only Display:**
- Email, created_at, last sign-in

**Editable Fields:**
- `name`
- `phone`
- `default_pickup_location`
- `active`

**Actions:**
- "Impersonate User" → Start impersonation session
- "Reset Password" → Triggers Supabase password reset email

**Related Data:**
- Services count (total, pending, delivered)
- Recent services list (last 5)

### 4. Services Browser (`/admin/services`)

Powerful table with filters for all services.

**Columns:**
- ID (truncated UUID)
- Client name
- Pickup → Delivery (truncated addresses)
- Status
- Request Status
- Date
- Price

**Filters:**
- By client
- By status (pending/delivered)
- By request_status
- By date range

**Search:**
- Location text
- Notes
- Client name

### 5. Service Detail (`/admin/services/[id]`)

Full service information with targeted edit capabilities.

**Read-only Display:**
- Client info
- Pickup/delivery locations
- Created at
- Distance

**Editable Fields:**
- `status`
- `delivered_at`
- `scheduled_date`
- `scheduled_time_slot`
- `calculated_price`
- `notes`

**Cannot Edit (too risky):**
- `client_id`
- `pickup_location` / `delivery_location`
- Location coordinates

**Action Buttons:**
- "Mark Delivered" → Sets status + delivered_at
- "Cancel Service" → Soft delete (sets deleted_at)
- "Recalculate Price" → Re-runs pricing logic

**Change History:**
- Audit log entries for this service shown at bottom

### 6. Impersonation System

View the app exactly as any user sees it.

**Flow:**
1. Admin clicks "Impersonate" on user detail page
2. Server sets session flag: `impersonating_user_id`
3. Root layout checks flag, fetches impersonated user's profile
4. All routes render as that user
5. Floating banner shows impersonation status
6. "Exit" clears flag, returns to admin view

**Capabilities While Impersonating:**
- See exactly what user sees
- Take actions as them (for bug reproduction)
- All actions logged with `performed_by_admin_id`

**Security:**
- Only `admin` role can impersonate
- Cannot impersonate other admins
- Auto-expires after 1 hour
- Start/end logged in audit log

**UI Banner:**
```
⚠️ Viewing as Maria's Bakery (client) · [Exit Impersonation]
```
Fixed position, bright yellow/orange background.

### 7. Audit Log Viewer (`/admin/audit`)

Browse all admin actions.

**Columns:**
- Timestamp
- Admin name
- Action
- Target (table + ID)
- Summary

**Filters:**
- By action type
- By target table
- By admin user
- By date range

**Expandable Rows:**
- Show full `old_value` and `new_value` JSON
- Diff view highlighting changes

### 8. Anomaly Alerts

Rule-based alerts shown on dashboard.

**Alert Rules:**
- "X services pending for more than 48 hours"
- "Client Y has no activity in 30 days"
- "Unusual spike: Z services created today vs. 7-day average"

**Implementation:**
- Computed on dashboard load (no background jobs)
- Thresholds configurable in Phase 2 via system config

**Optional (Phase 2):**
- Email notifications for critical alerts

---

## Phase 2: System Configuration

Deferred features to add later.

### Feature Flags (`/admin/config/features`)

Toggle switches for:
- `notifications_enabled`
- `calendar_view_enabled`
- `client_can_cancel`

### System Limits (`/admin/config/limits`)

Number inputs for:
- `max_services_per_day`
- `max_pending_requests`
- `default_urgency_fee_multiplier`

---

## UI Components

### Shared Components

- `AdminLayout.svelte` - Sidebar navigation + impersonation banner
- `DataTable.svelte` - Reusable table with sorting, filtering, pagination
- `AuditLogEntry.svelte` - Expandable audit log row
- `ImpersonationBanner.svelte` - Fixed position warning banner

### Design Notes

- Use existing shadcn-svelte components (Table, Card, Button, Input, Badge)
- Status colors consistent with app: blue (pending), green (delivered)
- Admin accent color: Purple or similar to distinguish from courier/client

---

## Implementation Order

1. **Database migrations** - Role constraint, audit_log table, feature_flags table
2. **Admin auth guard** - `+layout.server.ts` with role check
3. **Admin layout** - Sidebar navigation, basic structure
4. **Activity dashboard** - Stats, recent activity, alerts
5. **Users browser** - Table + filters
6. **User detail** - Profile view + edits + related data
7. **Services browser** - Table + filters + search
8. **Service detail** - View + targeted edits + actions
9. **Impersonation** - Session flag, banner, logging
10. **Audit log viewer** - Table + filters + expandable rows
11. **Phase 2** - Feature flags UI, system limits UI

---

## Security Considerations

- Admin routes protected by role check in layout
- All admin actions logged to audit_log
- Impersonation clearly indicated and time-limited
- Cannot impersonate other admins
- RLS policies enforce admin-only access to audit_log and feature_flags
- No direct database access exposed - all through Supabase client

---

## Open Questions

None at this time. Design is ready for implementation.
