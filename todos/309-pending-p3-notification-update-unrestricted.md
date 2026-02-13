---
status: pending
priority: p3
issue_id: "309"
tags: [security, rls, supabase, notifications]
dependencies: []
---

# Notification UPDATE Policy Has No Field Restrictions

## Problem Statement

The notifications UPDATE policy allows users to modify ANY field on their own notifications, including `email_id`, `email_sent_at`, `email_status`, `type`, `title`, `message`, and `service_id`. Users should only be able to modify `read` and `dismissed_at` fields.

## Findings

- Migration `20260121000011_create_notifications_table.sql` (lines 26-28) defines the UPDATE policy with no field restrictions
- The policy allows authenticated users to update any column on rows where `user_id = auth.uid()`
- Fields that should NOT be user-modifiable:
  - `email_id`, `email_sent_at`, `email_status` (email tracking data)
  - `type`, `title`, `message` (notification content)
  - `service_id` (notification metadata)
  - `user_id`, `created_at` (system fields)
- Fields that SHOULD be user-modifiable:
  - `read` (mark as read/unread)
  - `dismissed_at` (dismiss notification)
- Practical impact is low since tampering with notification fields doesn't grant additional privileges, but it violates data integrity (e.g., a user could mark email as "sent" when it wasn't, or change notification content)

**Affected file:** `supabase/migrations/20260121000011_create_notifications_table.sql` lines 26-28

## Proposed Solutions

### Option 1: BEFORE UPDATE Trigger on Notifications

**Approach:** Add a BEFORE UPDATE trigger that only allows changes to `read` and `dismissed_at` for non-courier users.

```sql
CREATE FUNCTION check_notification_update_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_courier() THEN
    IF NEW.email_id IS DISTINCT FROM OLD.email_id
       OR NEW.email_sent_at IS DISTINCT FROM OLD.email_sent_at
       OR NEW.type IS DISTINCT FROM OLD.type
       -- ... other restricted fields
    THEN
      RAISE EXCEPTION 'Can only update read and dismissed_at fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Pros:**
- Consistent with the trigger pattern used on profiles and services
- Granular control
- Easy to audit

**Cons:**
- Another trigger to maintain
- Small performance overhead on notification updates

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Restrict UPDATE Policy with Column List

**Approach:** Use PostgreSQL's column-level GRANT to restrict which columns can be updated. However, this doesn't work well with RLS.

**Pros:**
- Native PostgreSQL approach

**Cons:**
- GRANT/REVOKE on columns doesn't integrate cleanly with Supabase RLS
- More complex to manage

**Effort:** 2 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `supabase/migrations/20260121000011_create_notifications_table.sql` - current UPDATE policy
- New migration required for trigger

**Database changes:**
- Migration needed: Yes
- New trigger function: `check_notification_update_fields()`
- New trigger on `notifications` table

## Resources

- **Source:** RLS Security Audit - 4-agent parallel review

## Acceptance Criteria

- [ ] Users can still mark notifications as read/unread
- [ ] Users can still dismiss notifications (set dismissed_at)
- [ ] Users CANNOT modify email_id, email_sent_at, email_status
- [ ] Users CANNOT modify type, title, message, service_id
- [ ] Courier can still update all fields (for admin purposes)
- [ ] Migration applied with `supabase db push`

## Work Log

### 2026-02-13 - Initial Discovery

**By:** RLS Security Audit - 4-agent parallel review

**Actions:**
- Reviewed notifications table UPDATE policy
- Identified unrestricted field modifications
- Assessed impact (low -- no privilege escalation, but data integrity issue)
- Proposed trigger-based solution

**Learnings:**
- The notifications UPDATE policy follows the common "allow user to update own rows" pattern without field restrictions
- This is a data integrity issue rather than a privilege escalation
- The trigger approach is consistent with patterns used on profiles and services tables
