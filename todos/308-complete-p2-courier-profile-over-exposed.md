---
status: complete
priority: p2
issue_id: "308"
tags: [security, rls, supabase, profiles, information-leak]
dependencies: []
---

# Courier Profile Over-Exposed to Clients (37 Columns Readable)

## Problem Statement

The `profiles_select` RLS policy includes `OR (role = 'courier')`, meaning any authenticated user can read ALL 37 columns of the courier's profile. This was added so clients can see `pricing_mode` for service creation, but it over-exposes sensitive operational and business data.

## Findings

- Migration `20260131150000_allow_clients_read_courier_profile.sql` adds the policy `OR (role = 'courier')` to the SELECT policy
- This exposes the courier's entire profile row to any authenticated user, including:
  - **Physical location:** `warehouse_lat`, `warehouse_lng` (courier's warehouse/home location)
  - **Business pricing:** `vat_rate`, `minimum_charge`, `out_of_zone_base`, `out_of_zone_per_km`
  - **Internal operations:** `workload_settings`, `past_due_settings`
  - **Notification settings:** `notification_preferences`
- Fields clients legitimately need: `name`, `phone`, `pricing_mode`, `show_price_to_client`, `time_slots`, `working_days`, service type settings
- The warehouse location is particularly sensitive as it reveals the courier's physical base of operations

**Affected file:** `supabase/migrations/20260131150000_allow_clients_read_courier_profile.sql`

## Proposed Solutions

### Option 1: PostgreSQL View for Client-Facing Courier Data

**Approach:** Create a `courier_public_profile` view that exposes only the fields clients need. Clients query the view instead of the profiles table for courier data.

```sql
CREATE VIEW courier_public_profile AS
SELECT id, name, phone, pricing_mode, show_price_to_client,
       time_slots, working_days, time_specific_price, timezone
FROM profiles
WHERE role = 'courier';
```

**Pros:**
- Clean separation of public vs private courier data
- No risk of accidentally exposing new columns when schema changes
- View is easy to audit and maintain

**Cons:**
- Requires updating client-side queries to use the view
- May need RLS on the view or SECURITY DEFINER function
- Additional database object to maintain

**Effort:** 2-3 hours

**Risk:** Low-Medium - requires frontend changes

---

### Option 2: Column-Level Restrictions via Trigger

**Approach:** Keep the current policy but add a trigger or function that redacts sensitive columns when queried by non-courier users.

**Pros:**
- No frontend changes needed
- Transparent to existing queries

**Cons:**
- PostgreSQL doesn't support column-level RLS natively
- Trigger-based redaction is hacky and fragile
- Performance overhead on every SELECT

**Effort:** 3-4 hours

**Risk:** Medium-High - non-standard pattern, hard to maintain

---

### Option 3: Restrict SELECT Policy + Specific Column Queries

**Approach:** Remove the broad `OR (role = 'courier')` policy. Instead, have the app explicitly query only the needed columns, and create a more restrictive policy or RPC for client access to courier settings.

**Pros:**
- Most secure approach
- Minimal database changes

**Cons:**
- Requires auditing and updating all client-side queries that access courier profile
- May need an RPC function for complex queries

**Effort:** 2-4 hours

**Risk:** Medium - must find and update all affected queries

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `supabase/migrations/20260131150000_allow_clients_read_courier_profile.sql` - current policy
- Client-side queries that access courier profile data
- New migration required

**Database changes:**
- Migration needed: Yes
- Potentially: new view `courier_public_profile`
- Updated SELECT policy on profiles

## Resources

- **Source:** RLS Security Audit - 4-agent parallel review
- **Context:** Policy was added to let clients see `pricing_mode` for service creation form

## Acceptance Criteria

- [ ] Clients can still read courier's pricing_mode, time_slots, working_days
- [ ] Clients CANNOT read warehouse_lat/lng, vat_rate, workload_settings, past_due_settings
- [ ] Client service creation flow still works

## Work Log

### 2026-02-13 - Initial Discovery

**By:** RLS Security Audit - 4-agent parallel review

**Actions:**
- Reviewed the profiles SELECT policy and identified over-exposure
- Catalogued all 37 columns accessible to clients
- Identified which columns clients legitimately need vs sensitive data
- Proposed three solution approaches (view, trigger, restricted policy)

**Learnings:**
- The `OR (role = 'courier')` pattern was a quick fix for client access but exposes too much data
- The warehouse_lat/lng fields are particularly sensitive for a solo courier
- A view-based approach is the cleanest for limiting column exposure
