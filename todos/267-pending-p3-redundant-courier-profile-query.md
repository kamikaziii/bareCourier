---
status: pending
priority: p3
issue_id: "267"
tags: [code-review, performance, edge-function, pr-13]
dependencies: []
---

# Redundant Courier Profile Query in Daily Summary

## Problem Statement

The `daily-summary` edge function makes two separate queries to the `profiles` table for the same courier. These queries could be combined into a single query to reduce database round-trips.

**Why it matters:**
- Unnecessary database latency (minor but measurable)
- Inconsistent pattern compared to `check-past-due` which pre-fetches in one query
- Extra cost on Supabase (each query counts towards limits)

## Findings

**Location:** `supabase/functions/daily-summary/index.ts`

**Query 1 (lines 44-48):**
```typescript
const { data: courierData } = await supabase
  .from('profiles')
  .select('id, locale, past_due_settings, working_days, timezone')
  .eq('role', 'courier')
  .single();
```

**Query 2 (lines 189-195):**
```typescript
const { data: courierProfile } = await supabase
  .from('profiles')
  .select(
    'notification_preferences, timezone, working_days, push_notifications_enabled, email_notifications_enabled, locale'
  )
  .eq('id', courier.id)
  .single();
```

**Analysis:** Both queries fetch from the same `profiles` table for the same courier. The second query is needed for `dispatchNotification()`.

## Proposed Solutions

### Option A: Combine into single query (Recommended)
**Pros:** Single database round-trip, cleaner code
**Cons:** Slightly larger initial payload (negligible)
**Effort:** Small
**Risk:** Very Low

```typescript
const { data: courierData } = await supabase
  .from('profiles')
  .select('id, locale, past_due_settings, working_days, timezone, notification_preferences, push_notifications_enabled, email_notifications_enabled')
  .eq('role', 'courier')
  .single();

// Later, pass courierData directly to dispatchNotification
await dispatchNotification({
  // ...
  profile: courierData,
  // ...
});
```

### Option B: Keep as-is with comment
**Pros:** No code change, explicit separation of concerns
**Cons:** Redundant query remains
**Effort:** None
**Risk:** None

## Recommended Action

Implement Option A - combine the queries into a single fetch.

## Technical Details

- **Affected file:** `supabase/functions/daily-summary/index.ts`
- **Lines:** 44-48 and 189-195
- **Related:** `check-past-due/index.ts` already does this correctly (line 207-210)
- **Deployment:** `supabase functions deploy daily-summary`

## Acceptance Criteria

- [ ] Single query fetches all needed profile fields
- [ ] `dispatchNotification` receives the combined profile data
- [ ] Function behavior unchanged (same notifications sent)
- [ ] No regression in error handling

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from post-merge review of PRs #13-16 | Pattern already correct in check-past-due |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
- Related file: `supabase/functions/check-past-due/index.ts` (correct pattern)
