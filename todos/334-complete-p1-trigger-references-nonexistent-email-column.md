---
status: complete
priority: p1
issue_id: "334"
tags: [security, database, triggers, bug, code-review]
dependencies: []
---

# Profile trigger references non-existent `email` column — will crash on any client profile update

## Problem Statement

Migration 000003 (`add_profile_update_trigger.sql`) line 51-53 checks `NEW.email IS DISTINCT FROM OLD.email`, but the `profiles` table has **no `email` column**. In PostgreSQL, referencing a non-existent field on a trigger's NEW/OLD record causes a runtime error: `record "new" has no field "email"`. This means **every client profile update will fail with a 500 error**.

## Findings

- The `profiles` table was created in `20260121000001_initial_schema.sql` with columns: id, role, name, phone, default_pickup_location, active, created_at
- All subsequent `ALTER TABLE profiles ADD COLUMN` migrations were checked — none add an `email` column
- The `database.generated.ts` type file confirms no `email` field on profiles Row type
- The `email` field exists on `auth.users` (Supabase auth), not on `public.profiles`
- The trigger function is created successfully (PostgreSQL doesn't validate column references in plpgsql until execution)
- The trigger fires on EVERY `UPDATE` to profiles — any client saving their name, phone, locale, etc. will hit this

**Location:** `supabase/migrations/20260213000003_add_profile_update_trigger.sql:51-53`

```sql
IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Clients cannot modify email';
END IF;
```

## Proposed Solutions

### Option 1: Remove the email check (Recommended)
Delete lines 51-53 from the trigger function. Email lives in `auth.users`, not `profiles`, so there's nothing to protect here.
- **Pros**: Fixes the crash, simple
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Technical Details
- **Affected Files**: `supabase/migrations/20260213000003_add_profile_update_trigger.sql`
- **Related Components**: All client profile update flows (settings, timezone, notification preferences)
- **Database Changes**: Yes — rewrite trigger function without email check

## Acceptance Criteria
- [ ] Client can update their profile (name, phone, locale, etc.) without error
- [ ] Trigger still blocks all other sensitive columns

## Work Log

### 2026-02-13 - Discovered during manual verification
**By:** Claude Code Review (verification pass)
**Actions:**
- All 6 review agents missed this — discovered by reading actual source code against generated types
- Confirmed no `email` column exists via: initial schema, all ALTER TABLE migrations, database.generated.ts

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
- Migration 000003 (profile trigger)
- Initial schema: 20260121000001_initial_schema.sql
