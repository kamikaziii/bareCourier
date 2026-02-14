---
status: complete
priority: p1
issue_id: "305"
tags: [security, critical, rls, supabase, profiles]
dependencies: []
---

# Profile Role Escalation via Unrestricted UPDATE Policy

## Problem Statement

The `profiles` table UPDATE policy allows clients to update ANY field on their own profile, including `role`. There is NO BEFORE UPDATE trigger restricting field modifications. A client can escalate to courier with a single SQL statement, gaining full admin access to all services, profiles, pricing data, and RPC functions.

This is a **critical** security vulnerability that allows privilege escalation from client to courier (admin) role.

## Findings

- The UPDATE policy in migration `20260121000004_fix_rls_infinite_recursion.sql` (lines 32-35) is `id = auth.uid() OR is_courier()`, which allows clients to update their own profile row with no field restrictions
- There is no BEFORE UPDATE trigger on the `profiles` table that restricts which fields can be modified
- A client can escalate privileges with: `UPDATE profiles SET role = 'courier' WHERE id = auth.uid()`
- Once escalated, the attacker gains:
  - Full read access to all profiles (courier sees all)
  - Full read/write access to all services
  - Access to pricing configuration, workload settings, past due settings
  - Ability to call courier-only RPC functions
  - Access to all client data across the platform

**Affected file:** `supabase/migrations/20260121000004_fix_rls_infinite_recursion.sql` lines 32-35

## Proposed Solutions

### Option 1: BEFORE UPDATE Trigger with Client Field Allowlist

**Approach:** Create a `check_client_profile_update_fields()` BEFORE UPDATE trigger on profiles that blocks clients from modifying restricted fields. Only the courier can modify administrative fields.

**Restricted fields (clients cannot modify):**
- `role`, `active`
- Pricing: `pricing_mode`, `minimum_charge`, `out_of_zone_base`, `out_of_zone_per_km`
- VAT: `vat_enabled`, `vat_rate`, `prices_include_vat`
- Display: `round_distance`, `show_price_to_client`, `show_price_to_courier`
- Scheduling: `time_slots`, `time_specific_price`, `working_days`
- Operations: `workload_settings`, `past_due_settings`
- Warehouse: `warehouse_lat`, `warehouse_lng`
- Branding: `label_business_name`, `label_tagline`
- System: `timezone`

**Allowed fields for clients:**
- `name`, `phone`, `locale`
- `default_pickup_location`, `default_pickup_lat`, `default_pickup_lng`
- `push_subscription`, `push_enabled`, `email_notifications_enabled`
- `notification_preferences`
- `default_service_type_id`, `default_urgency_fee_id`

**Pros:**
- Directly prevents role escalation
- Granular control over which fields each role can modify
- Consistent with the existing `check_client_service_update_fields()` pattern on services table

**Cons:**
- Must be maintained when new columns are added to profiles
- Denylist approach (blocking specific fields) vs allowlist requires careful review

**Effort:** 1-2 hours

**Risk:** Low - straightforward trigger, well-established pattern in codebase

---

### Option 2: Separate RLS Policies per Role

**Approach:** Split the single UPDATE policy into two: one for courier (all fields) and one for client (restricted columns via a PostgreSQL view or column-level security).

**Pros:**
- Policy-level enforcement without triggers
- Cleaner separation of concerns

**Cons:**
- PostgreSQL RLS doesn't support column-level restrictions natively
- Would require a view-based approach, adding complexity
- May conflict with existing query patterns

**Effort:** 3-4 hours

**Risk:** Medium - more architectural change, harder to test

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `supabase/migrations/20260121000004_fix_rls_infinite_recursion.sql` - current UPDATE policy
- New migration required to add BEFORE UPDATE trigger

**Database changes:**
- Migration needed: Yes
- New trigger function: `check_client_profile_update_fields()`
- New trigger: `enforce_client_profile_update_fields` BEFORE UPDATE on `profiles`

## Resources

- **Source:** RLS Security Audit - 4-agent parallel review
- **Similar pattern:** `check_client_service_update_fields()` trigger on services table

## Acceptance Criteria

- [ ] BEFORE UPDATE trigger on profiles prevents client from changing `role`
- [ ] Client can still update: name, phone, default_pickup_location, default_pickup_lat/lng, locale, push/email notification settings, notification_preferences, default_service_type_id, default_urgency_fee_id
- [ ] Courier can still update all fields
- [ ] Migration applied with `supabase db push`
- [ ] E2E test verifies client cannot change role

## Work Log

### 2026-02-13 - Initial Discovery

**By:** RLS Security Audit - 4-agent parallel review

**Actions:**
- Identified unrestricted UPDATE policy on profiles table
- Verified no BEFORE UPDATE trigger exists to restrict field modifications
- Confirmed privilege escalation path from client to courier role
- Documented affected migration and line numbers
- Drafted trigger-based solution approach

**Learnings:**
- The profiles table UPDATE policy follows the same pattern as other tables but lacks field-level restrictions
- The services table already has a `check_client_service_update_fields()` trigger that can serve as a template
