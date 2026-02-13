---
status: complete
priority: p1
issue_id: "306"
tags: [security, high, rls, supabase, services, trigger]
dependencies: []
---

# Services Trigger Denylist Leaves ~35 Fields Unprotected

## Problem Statement

The `check_client_service_update_fields()` trigger uses a denylist pattern -- it only blocks ~20 explicitly listed fields out of 55 total columns on the services table. On non-pending (accepted) services, many security-sensitive fields remain unprotected and can be modified by clients.

## Findings

- The trigger in migration `20260213000001_fix_trigger_restore_pending_edit.sql` explicitly blocks ~20 fields but leaves the rest unprotected
- On non-pending (accepted) services, the following fields are **unprotected**:
  - **Pricing fields:** `service_type_id`, `tolls`, `vat_rate_snapshot`, `prices_include_vat_snapshot`, `is_out_of_zone`, `pickup_is_out_of_zone`
  - **Scheduling fields:** `scheduled_time` (date IS blocked but time is NOT), `suggested_time` (same gap)
  - **Display/identity fields:** `display_id`
  - **Reschedule fields:** `pending_reschedule_*` (6 fields), `reschedule_count`, `last_rescheduled_at`, `last_rescheduled_by`
  - **Audit fields:** `price_override_reason`, `detected_municipality`, `pickup_detected_municipality`, `duration_minutes`, `has_time_preference`, `rejection_reason`, `created_at`, `last_past_due_notification_at`
- A client could modify `service_type_id` to change pricing tier, set `tolls` to negative values, or alter `display_id` to cause confusion

**Affected file:** `supabase/migrations/20260213000001_fix_trigger_restore_pending_edit.sql`

## Proposed Solutions

### Option A: Expand the Denylist (Minimum Fix)

**Approach:** Add all missing security-sensitive fields to the existing denylist in the trigger.

Fields to add:
- `service_type_id`, `tolls`, `vat_rate_snapshot`, `prices_include_vat_snapshot`
- `is_out_of_zone`, `pickup_is_out_of_zone`
- `scheduled_time`, `suggested_time`
- `display_id`
- `pending_reschedule_*` (6 fields), `reschedule_count`, `last_rescheduled_at`, `last_rescheduled_by`
- `price_override_reason`, `detected_municipality`, `pickup_detected_municipality`
- `duration_minutes`, `has_time_preference`, `rejection_reason`
- `created_at`, `last_past_due_notification_at`

**Pros:**
- Minimal change to existing trigger logic
- Quick to implement
- Lower risk of breaking existing flows

**Cons:**
- Denylist pattern remains -- future columns added to `services` will be unprotected by default
- Requires ongoing vigilance when schema changes

**Effort:** 1-2 hours

**Risk:** Low

---

### Option B: Switch to Allowlist Pattern (Ideal Fix)

**Approach:** Rewrite the trigger to define exactly which fields clients CAN modify on non-pending services, and block everything else. This prevents future regressions when new columns are added.

Allowed fields for clients on non-pending services:
- `notes` (already allowed in current trigger)
- Potentially none others for accepted services

**Pros:**
- Future-proof -- new columns are blocked by default
- Eliminates the entire class of "forgotten field" vulnerabilities
- Cleaner, more maintainable code

**Cons:**
- Larger rewrite of the trigger function
- Must carefully enumerate all legitimate client modification paths
- Higher risk of accidentally blocking a valid update flow

**Effort:** 2-4 hours

**Risk:** Medium - requires thorough testing of all client update flows

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `supabase/migrations/20260213000001_fix_trigger_restore_pending_edit.sql` - current trigger
- New migration required to update trigger function

**Database changes:**
- Migration needed: Yes
- Updated trigger function: `check_client_service_update_fields()`
- No new tables/columns

## Resources

- **Source:** RLS Security Audit - 4-agent parallel review
- **Related:** Finding #3 (suggestion response bypass) depends on this trigger

## Acceptance Criteria

- [ ] On accepted services, clients cannot modify pricing fields (service_type_id, tolls, vat snapshots, zone flags)
- [ ] `scheduled_time` and `suggested_time` are blocked alongside their `_date` and `_time_slot` counterparts
- [ ] `display_id` cannot be modified by clients
- [ ] `pending_reschedule_*` fields cannot be set directly (only via RPC)
- [ ] Migration applied with `supabase db push`

## Work Log

### 2026-02-13 - Initial Discovery

**By:** RLS Security Audit - 4-agent parallel review

**Actions:**
- Audited all 55 columns on the services table against the trigger denylist
- Identified ~35 unprotected fields on non-pending services
- Categorized unprotected fields by severity (pricing, scheduling, identity, audit)
- Proposed both denylist expansion and allowlist rewrite approaches

**Learnings:**
- Denylist patterns are inherently fragile -- every new column must be manually added
- The allowlist pattern used by some other systems is more robust but requires more upfront work
- The `scheduled_time` vs `scheduled_date` gap suggests the trigger was written field-by-field rather than by category
