# Settings Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all verified bugs and issues from the settings page review

**Architecture:** Server-side validation, timezone-aware Edge Functions, consistent defaults, code cleanup

**Tech Stack:** SvelteKit, Supabase Edge Functions (Deno), TypeScript

---

## Summary of Confirmed Issues

| Priority | Issue | Impact |
|----------|-------|--------|
| P1 | Urgency fee delete check always fails | Data integrity - can delete fees in use |
| P1 | Edge Function timezone handling | Wrong notification timing |
| P1 | Daily summary hour boundary check | Notifications not sent |
| P2 | Input validation missing | Invalid data stored |
| P2 | Layout missing fields | Other pages lack data |
| P2 | Inconsistent default time slots | Confusing behavior |
| P2 | Urgent check uses UTC | Wrong urgent detection |
| P2 | Date query mismatch near midnight | Edge case bug |
| P3 | Role verification (partial) | Security best practice |
| P3 | Code quality issues | Maintainability |

---

## Task 1: Fix Urgency Fee Delete Check

**Files:**
- Modify: `src/routes/courier/settings/+page.server.ts:208-217`

**Step 1: Fix the count check**

```typescript
// Before (broken):
const { data: usageCount } = await (supabase as any)
  .from('services')
  .select('id', { count: 'exact', head: true })
  .eq('urgency_fee_id', id);

if (usageCount && usageCount.length > 0) {
  return { success: false, error: 'urgency_in_use' };
}

// After (fixed):
const { count } = await (supabase as any)
  .from('services')
  .select('id', { count: 'exact', head: true })
  .eq('urgency_fee_id', id);

if (count && count > 0) {
  return { success: false, error: 'urgency_in_use' };
}
```

**Step 2: Verify fix**

Run: `pnpm run check`

**Step 3: Commit**

```bash
git add src/routes/courier/settings/+page.server.ts
git commit -m "fix: urgency fee delete check uses count property correctly"
```

---

## Task 2: Add Input Validation for New Settings

**Files:**
- Modify: `src/routes/courier/settings/+page.server.ts:478-555`

**Step 1: Add validation helpers at top of file (after imports)**

```typescript
// Validation helpers
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const VALID_TIMEZONES = ['Europe/Lisbon', 'Europe/London', 'Europe/Paris', 'Europe/Madrid', 'Atlantic/Azores', 'Atlantic/Madeira'] as const;

function isValidTime(time: string): boolean {
  return TIME_REGEX.test(time);
}

function isValidTimeRange(start: string, end: string): boolean {
  return isValidTime(start) && isValidTime(end) && start < end;
}

function isValidWorkingDay(day: string): day is typeof VALID_DAYS[number] {
  return VALID_DAYS.includes(day as typeof VALID_DAYS[number]);
}

function isValidTimezone(tz: string): tz is typeof VALID_TIMEZONES[number] {
  return VALID_TIMEZONES.includes(tz as typeof VALID_TIMEZONES[number]);
}
```

**Step 2: Add validation to updateTimeSlots action**

```typescript
updateTimeSlots: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const formData = await request.formData();
  const timeSlots = {
    morning: {
      start: formData.get('morning_start') as string,
      end: formData.get('morning_end') as string
    },
    afternoon: {
      start: formData.get('afternoon_start') as string,
      end: formData.get('afternoon_end') as string
    },
    evening: {
      start: formData.get('evening_start') as string,
      end: formData.get('evening_end') as string
    }
  };

  // Validate all time slots
  for (const [slot, times] of Object.entries(timeSlots)) {
    if (!isValidTimeRange(times.start, times.end)) {
      return { success: false, error: `Invalid time range for ${slot}` };
    }
  }

  // ... rest of action
```

**Step 3: Add validation to updateWorkingDays action**

```typescript
updateWorkingDays: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const formData = await request.formData();
  const workingDays = formData.getAll('working_days') as string[];

  // Validate all days
  const invalidDays = workingDays.filter(day => !isValidWorkingDay(day));
  if (invalidDays.length > 0) {
    return { success: false, error: `Invalid working days: ${invalidDays.join(', ')}` };
  }

  // ... rest of action
```

**Step 4: Add validation to updateTimezone action**

```typescript
updateTimezone: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const formData = await request.formData();
  const timezone = formData.get('timezone') as string;

  // Validate timezone
  if (!isValidTimezone(timezone)) {
    return { success: false, error: 'Invalid timezone' };
  }

  // ... rest of action
```

**Step 5: Verify**

Run: `pnpm run check`

**Step 6: Commit**

```bash
git add src/routes/courier/settings/+page.server.ts
git commit -m "feat: add input validation for time slots, working days, timezone"
```

---

## Task 3: Fix Edge Function Timezone Handling

**Files:**
- Modify: `supabase/functions/check-past-due/index.ts:61-80`

**Step 1: Update getCutoffTime to be timezone-aware**

```typescript
function getCutoffTime(
  service: Service,
  gracePeriod: number,
  timeSlots: TimeSlots | null,
  timezone: string
): Date | null {
  if (!service.scheduled_date) return null;

  // Parse the scheduled date in the courier's timezone
  // Create a date string that represents the date in the target timezone
  const dateStr = service.scheduled_date; // "2025-07-15"

  let cutoffTimeStr: string;
  if (service.scheduled_time_slot === 'specific' && service.scheduled_time) {
    cutoffTimeStr = service.scheduled_time;
  } else if (service.scheduled_time_slot) {
    cutoffTimeStr = getSlotCutoff(service.scheduled_time_slot, timeSlots);
  } else {
    cutoffTimeStr = '17:00';
  }

  // Create a timestamp in the courier's timezone
  // Use Intl.DateTimeFormat to parse the local time correctly
  const localDateTimeStr = `${dateStr}T${cutoffTimeStr}:00`;

  // Get the UTC offset for the timezone at this date/time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Parse as if it's in the target timezone
  // This is a workaround for Deno's date handling
  const date = new Date(localDateTimeStr);

  // Adjust for timezone offset
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const offset = utcDate.getTime() - tzDate.getTime();

  const cutoffUtc = new Date(date.getTime() + offset);

  // Add grace period
  return new Date(cutoffUtc.getTime() + gracePeriod * 60 * 1000);
}
```

**Step 2: Update the function call**

```typescript
const cutoff = getCutoffTime(service, gracePeriod, timeSlots, courierTimezone);
```

**Step 3: Deploy and test**

Run: `supabase functions deploy check-past-due`

**Step 4: Commit**

```bash
git add supabase/functions/check-past-due/index.ts
git commit -m "fix: timezone-aware cutoff time calculation in check-past-due"
```

---

## Task 4: Fix Daily Summary Hour Boundary Check

**Files:**
- Modify: `supabase/functions/daily-summary/index.ts:77-84`

**Step 1: Fix time window check using total minutes**

```typescript
// Before (broken):
const [prefHour, prefMin] = preferredTime.split(':').map(Number);
const [localHour, localMin] = localTime.split(':').map(Number);

if (localHour !== prefHour || Math.abs(localMin - prefMin) > 7) {
  return new Response(JSON.stringify({ message: 'Not the right time', sent: false }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// After (fixed):
const [prefHour, prefMin] = preferredTime.split(':').map(Number);
const [localHour, localMin] = localTime.split(':').map(Number);

const prefTotalMin = prefHour * 60 + prefMin;
const localTotalMin = localHour * 60 + localMin;

if (Math.abs(localTotalMin - prefTotalMin) > 7) {
  return new Response(JSON.stringify({ message: 'Not the right time', sent: false }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

**Step 2: Fix urgent check to use local hour**

```typescript
// Before (broken - line 121):
const hour = now.getHours();

// After (fixed):
const localHourForUrgent = parseInt(
  now.toLocaleTimeString('en-GB', {
    timeZone: courierTimezone,
    hour: '2-digit',
    hour12: false
  }),
  10
);

// Update usage (lines 127-131):
if (
  (service.scheduled_time_slot === 'morning' && localHourForUrgent >= 11) ||
  (service.scheduled_time_slot === 'afternoon' && localHourForUrgent >= 16) ||
  (service.scheduled_time_slot === 'evening' && localHourForUrgent >= 20)
) {
  urgent++;
}
```

**Step 3: Deploy and test**

Run: `supabase functions deploy daily-summary`

**Step 4: Commit**

```bash
git add supabase/functions/daily-summary/index.ts
git commit -m "fix: daily summary time window and urgent check use local timezone"
```

---

## Task 5: Unify Default Time Slots

**Files:**
- Create: `src/lib/constants/scheduling.ts`
- Modify: `src/lib/utils/past-due.ts`
- Modify: `src/routes/courier/settings/SchedulingTab.svelte`
- Modify: `src/routes/courier/settings/NotificationsTab.svelte`

**Step 1: Create shared constants file**

```typescript
// src/lib/constants/scheduling.ts
import type { TimeSlotDefinitions, WorkingDay, PastDueSettings } from '$lib/database.types';

export const DEFAULT_TIME_SLOTS: TimeSlotDefinitions = {
  morning: { start: '08:00', end: '12:00' },
  afternoon: { start: '12:00', end: '17:00' },
  evening: { start: '17:00', end: '21:00' }
};

export const DEFAULT_WORKING_DAYS: WorkingDay[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

export const DEFAULT_PAST_DUE_SETTINGS: PastDueSettings = {
  gracePeriodStandard: 30,
  gracePeriodSpecific: 15,
  thresholdApproaching: 120,
  thresholdUrgent: 60,
  thresholdCriticalHours: 24,
  allowClientReschedule: true,
  clientMinNoticeHours: 24,
  clientMaxReschedules: 3,
  pastDueReminderInterval: 60,
  dailySummaryEnabled: true,
  dailySummaryTime: '08:00'
};

export const VALID_DAYS: readonly WorkingDay[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

export const VALID_TIMEZONES = [
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Paris',
  'Europe/Madrid',
  'Atlantic/Azores',
  'Atlantic/Madeira'
] as const;
```

**Step 2: Update past-due.ts to import from constants**

```typescript
import { DEFAULT_TIME_SLOTS, DEFAULT_PAST_DUE_SETTINGS } from '$lib/constants/scheduling';

export const DEFAULT_CONFIG: PastDueConfig = {
  timeSlots: DEFAULT_TIME_SLOTS,
  gracePeriodStandard: DEFAULT_PAST_DUE_SETTINGS.gracePeriodStandard,
  gracePeriodSpecific: DEFAULT_PAST_DUE_SETTINGS.gracePeriodSpecific,
  thresholdApproaching: DEFAULT_PAST_DUE_SETTINGS.thresholdApproaching,
  thresholdUrgent: DEFAULT_PAST_DUE_SETTINGS.thresholdUrgent,
  thresholdCriticalHours: DEFAULT_PAST_DUE_SETTINGS.thresholdCriticalHours
};
```

**Step 3: Update SchedulingTab.svelte to import from constants**

```typescript
import { DEFAULT_TIME_SLOTS, DEFAULT_WORKING_DAYS, DEFAULT_PAST_DUE_SETTINGS, VALID_DAYS } from '$lib/constants/scheduling';

// Remove local definitions, use imports:
const defaultTimeSlots = DEFAULT_TIME_SLOTS;
const defaultWorkingDays = DEFAULT_WORKING_DAYS;
const defaultPastDueSettings = DEFAULT_PAST_DUE_SETTINGS;
const allDays = VALID_DAYS;
```

**Step 4: Update NotificationsTab.svelte similarly**

**Step 5: Verify**

Run: `pnpm run check`

**Step 6: Commit**

```bash
git add src/lib/constants/scheduling.ts src/lib/utils/past-due.ts \
  src/routes/courier/settings/SchedulingTab.svelte \
  src/routes/courier/settings/NotificationsTab.svelte
git commit -m "refactor: centralize scheduling defaults in constants file"
```

---

## Task 6: Add Missing Fields to Layout

**Files:**
- Modify: `src/routes/courier/+layout.server.ts:37-48`

**Step 1: Add missing fields**

```typescript
return {
  profile: {
    id: profile.id,
    role: profile.role,
    name: profile.name,
    past_due_settings: profile.past_due_settings,
    time_slots: profile.time_slots,
    working_days: profile.working_days,  // Add
    timezone: profile.timezone           // Add
  },
  navCounts: {
    pendingRequests: (pendingRequestsResult.count ?? 0) + (pendingReschedulesResult.count ?? 0)
  }
};
```

**Step 2: Verify**

Run: `pnpm run check`

**Step 3: Commit**

```bash
git add src/routes/courier/+layout.server.ts
git commit -m "fix: include working_days and timezone in courier layout profile"
```

---

## Task 7: Fix Date Query Mismatch in check-past-due

**Files:**
- Modify: `supabase/functions/check-past-due/index.ts:153`

**Step 1: Use local date for query**

```typescript
// Before:
const todayStr = now.toISOString().split('T')[0];

// After (use local date):
const localDate = new Date(now.toLocaleString('en-US', { timeZone: courierTimezone }));
const todayStr = localDate.toISOString().split('T')[0];
```

Note: Move this AFTER the courierTimezone is defined (around line 124).

**Step 2: Deploy**

Run: `supabase functions deploy check-past-due`

**Step 3: Commit**

```bash
git add supabase/functions/check-past-due/index.ts
git commit -m "fix: use local date for service query in check-past-due"
```

---

## Task 8: Fix Time Slots Grid Responsiveness

**Files:**
- Modify: `src/routes/courier/settings/SchedulingTab.svelte:108`

**Step 1: Add responsive breakpoint**

```svelte
<!-- Before: -->
<div class="grid grid-cols-3 gap-4 items-center">

<!-- After: -->
<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
```

**Step 2: Commit**

```bash
git add src/routes/courier/settings/SchedulingTab.svelte
git commit -m "fix: make time slots grid responsive on mobile"
```

---

## Task 9: Use bind:value for Time Inputs

**Files:**
- Modify: `src/routes/courier/settings/SchedulingTab.svelte:112,116`

**Step 1: Replace value+oninput with bind:value**

```svelte
<!-- Before: -->
<Input
  type="time"
  name="{slot}_start"
  value={timeSlots[slotKey].start}
  oninput={(e) => timeSlots[slotKey].start = (e.target as HTMLInputElement).value}
/>

<!-- After: -->
<Input
  type="time"
  name="{slot}_start"
  bind:value={timeSlots[slotKey].start}
/>
```

Apply to both start and end inputs.

**Step 2: Commit**

```bash
git add src/routes/courier/settings/SchedulingTab.svelte
git commit -m "refactor: use bind:value for time slot inputs"
```

---

## Task 10: Remove Checkbox name/value (Cleanup)

**Files:**
- Modify: `src/routes/courier/settings/SchedulingTab.svelte:139-144`

**Step 1: Remove unnecessary props**

```svelte
<!-- Before: -->
<Checkbox
  name="working_days"
  value={day}
  checked={workingDays.includes(day)}
  onCheckedChange={(checked) => toggleWorkingDay(day, checked === true)}
/>

<!-- After: -->
<Checkbox
  checked={workingDays.includes(day)}
  onCheckedChange={(checked) => toggleWorkingDay(day, checked === true)}
/>
```

**Step 2: Commit**

```bash
git add src/routes/courier/settings/SchedulingTab.svelte
git commit -m "refactor: remove unused name/value from Checkbox component"
```

---

## Task 11: Final Verification

**Step 1: Run type check**

```bash
pnpm run check
```

**Step 2: Test locally**

```bash
pnpm run dev
```

Manual tests:
- [ ] Time slots form saves correctly
- [ ] Working days form saves correctly
- [ ] Timezone form saves correctly
- [ ] Try to delete an urgency fee that's in use (should fail)
- [ ] Check responsive layout on mobile viewport

**Step 3: Deploy Edge Functions**

```bash
supabase functions deploy check-past-due
supabase functions deploy daily-summary
```

---

## Deferred Items (Not Critical)

These issues were identified but don't need immediate fixes:

1. **Role verification on all actions** - Low risk since queries filter by user.id
2. **Daily summary deduplication** - Low risk, 15-min window prevents most duplicates
3. **Additional timezone options** - Feature enhancement, not a bug
4. **Inline SVG** - Minor code style issue
5. **Magic strings** - Minor refactoring opportunity
6. **Excessive `as any`** - Requires Supabase types update

---

## Execution Order

| Batch | Tasks | Rationale |
|-------|-------|-----------|
| 1 | 1, 2 | Critical server-side fixes |
| 2 | 3, 4, 7 | Edge Function fixes (deploy together) |
| 3 | 5, 6 | Code organization |
| 4 | 8, 9, 10 | UI improvements |
| 5 | 11 | Verification |

---

## Post-Implementation

After all tasks complete:
1. Update `docs/plans/2026-01-26-settings-review-findings.md` status to "Fixed"
2. Consider running review agents again to verify fixes
