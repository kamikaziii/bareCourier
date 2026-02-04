---
status: ready
priority: p2
issue_id: "248"
tags: [code-review, data-quality, migration, pr-13]
dependencies: []
---

# Email Status Column Default Marks Old Rows as 'pending'

## Problem Statement

The migration adds `email_status text DEFAULT 'pending'` to the notifications table. This backfills ALL existing notifications with 'pending' status, which is misleading since they were created before email capability existed.

## Findings

**Source:** data-migration-expert agent, data-integrity-guardian agent

**Location:** `supabase/migrations/20260204000004_add_email_tracking_columns.sql` line 5

**Current code:**
```sql
ADD COLUMN IF NOT EXISTS email_status text DEFAULT 'pending';
```

**Impact:**
- Historical notifications incorrectly marked as 'pending' email
- Could trigger false alerts for "stuck" email deliveries
- Misleading analytics/reporting

## Proposed Solutions

### Solution 1: Use NULL Default (Recommended)
**Pros:** Clear distinction between old and new
**Cons:** Requires code to handle NULL
**Effort:** Small
**Risk:** Low

```sql
ADD COLUMN IF NOT EXISTS email_status text DEFAULT NULL;
```

### Solution 2: Add 'not_applicable' Status
**Pros:** Explicit about old rows
**Cons:** Requires backfill
**Effort:** Medium
**Risk:** Low

```sql
ADD COLUMN IF NOT EXISTS email_status text DEFAULT 'pending';
-- Then backfill:
UPDATE notifications
SET email_status = 'not_applicable'
WHERE created_at < NOW() - INTERVAL '1 minute';
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `supabase/migrations/20260204000004_add_email_tracking_columns.sql`

**Table:** `notifications`

## Acceptance Criteria

- [ ] Old notifications clearly distinguished from new
- [ ] No false positives in email delivery monitoring
- [ ] Analytics correctly reflect actual email status

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Default values affect historical data |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
