---
status: ready
priority: p3
issue_id: "265"
tags: [code-review, data-integrity, pr-13]
dependencies: []
---

# Daily Summary Has No Deduplication Mechanism

## Problem Statement

Unlike `check-past-due` which uses an atomic claim pattern with `last_past_due_notification_at`, the `daily-summary` function has no database-level deduplication. If the cron job fires twice within the 15-minute window, the courier receives duplicate summaries.

**Why it matters:**
- Cron scheduling can drift or fire multiple times during infrastructure issues
- DST transitions create edge cases in time matching
- Duplicate notifications are annoying and unprofessional

## Findings

**Location:** `supabase/functions/daily-summary/index.ts`

**Current protection (time window only):**
```typescript
// Use 14-minute tolerance to handle DST transitions
if (Math.abs(localTotalMin - prefTotalMin) > 14) {
    return new Response(JSON.stringify({ message: 'Not the right time', sent: false }), ...);
}
```

**No database-level check like check-past-due has:**
```typescript
// check-past-due uses this pattern:
const previousValue = service.last_past_due_notification_at;
// Atomic claim with WHERE condition...
```

## Proposed Solutions

### Option A: Add last_daily_summary_sent_at to courier profile (Recommended)
**Pros:** Database-level deduplication, matches check-past-due pattern
**Cons:** Requires migration
**Effort:** Medium
**Risk:** Low

```sql
-- Migration
ALTER TABLE profiles ADD COLUMN last_daily_summary_sent_at timestamptz;

-- In daily-summary function
const { data: courier } = await supabase
    .from('profiles')
    .select('..., last_daily_summary_sent_at')
    .eq('role', 'courier')
    .single();

// Check if already sent today
const lastSent = courier.last_daily_summary_sent_at
    ? new Date(courier.last_daily_summary_sent_at)
    : null;
const today = new Date().toISOString().split('T')[0];
const lastSentDate = lastSent?.toISOString().split('T')[0];

if (lastSentDate === today) {
    return { message: 'Already sent today' };
}

// After sending, update timestamp
await supabase
    .from('profiles')
    .update({ last_daily_summary_sent_at: new Date().toISOString() })
    .eq('id', courier.id);
```

### Option B: Use notifications table for deduplication
**Pros:** No migration needed
**Cons:** Query overhead, less explicit
**Effort:** Small
**Risk:** Very Low

```typescript
// Check if daily_summary notification exists for today
const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', courier.id)
    .eq('type', 'daily_summary')
    .gte('created_at', todayStart)
    .limit(1);

if (existing?.length > 0) {
    return { message: 'Already sent today' };
}
```

## Recommended Action

Implement Option B as a quick fix (no migration needed), then consider Option A for long-term robustness.

## Technical Details

- **Affected file:** `supabase/functions/daily-summary/index.ts`
- **Migration (if Option A):** Add `last_daily_summary_sent_at` column to profiles
- **Deployment:** `supabase functions deploy daily-summary`

## Acceptance Criteria

- [ ] Daily summary cannot be sent twice on the same day
- [ ] Deduplication survives cron re-fires
- [ ] DST transitions don't cause duplicates
- [ ] Test: Manually trigger function twice, verify only one notification created

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from post-merge audit | Time-based checks alone aren't sufficient |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
- check-past-due atomic claim pattern for reference
