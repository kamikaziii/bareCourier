# Past Due System & Rescheduling Design

## Overview

This document describes the design for a past due detection system and rescheduling workflow for bareCourier. The system helps the courier track overdue deliveries, provides visual urgency indicators, and enables flexible rescheduling with client notifications.

## Goals

1. **Visibility**: Clearly show which services are past due or approaching deadline
2. **Proactive management**: Alert courier before services become overdue
3. **Flexibility**: Enable easy rescheduling with client communication
4. **Configurability**: Allow courier to customize thresholds and policies
5. **Audit trail**: Track all schedule changes for accountability

## Non-Goals

- Automatic rescheduling (courier maintains control)
- Real-time GPS tracking
- Route optimization based on urgency

---

## 1. Past Due Detection

### 1.1 Time Slot Cutoffs

Services have time slots with defined end times (cutoffs):

| Time Slot | Description | Default Cutoff |
|-----------|-------------|----------------|
| `morning` | Before lunch | 12:00 |
| `afternoon` | After lunch | 17:00 |
| `evening` | After work | 21:00 |
| `specific` | Exact time | `scheduled_time` |

### 1.2 Grace Periods

Buffer time after cutoff before marking as past due:

| Time Slot Type | Default Grace Period |
|----------------|---------------------|
| Standard (morning/afternoon/evening) | 30 minutes |
| Specific time | 15 minutes |

### 1.3 Urgency Levels

| Level | Condition | Color | Badge Text |
|-------|-----------|-------|------------|
| `on_track` | > 2 hours before cutoff | Green | None |
| `approaching` | 1-2 hours before cutoff | Yellow | "Due Soon" |
| `urgent` | < 1 hour before cutoff | Orange | "Due Soon" |
| `past_due` | After cutoff + grace | Red | "Past Due" |
| `critical` | > 24 hours past due | Dark Red | "Critical" |

### 1.4 Detection Logic

```typescript
// src/lib/utils/past-due.ts

export type UrgencyLevel = 'on_track' | 'approaching' | 'urgent' | 'past_due' | 'critical';

export type TimeSlotConfig = {
  morning: { start: string; end: string };
  afternoon: { start: string; end: string };
  evening: { start: string; end: string };
};

export type PastDueConfig = {
  timeSlots: TimeSlotConfig;
  gracePeriodStandard: number;  // minutes
  gracePeriodSpecific: number;  // minutes
  thresholdApproaching: number; // minutes before cutoff
  thresholdUrgent: number;      // minutes before cutoff
  thresholdCriticalHours: number; // hours after past due
};

export const DEFAULT_CONFIG: PastDueConfig = {
  timeSlots: {
    morning: { start: '08:00', end: '12:00' },
    afternoon: { start: '12:00', end: '17:00' },
    evening: { start: '17:00', end: '21:00' }
  },
  gracePeriodStandard: 30,
  gracePeriodSpecific: 15,
  thresholdApproaching: 120, // 2 hours
  thresholdUrgent: 60,       // 1 hour
  thresholdCriticalHours: 24
};

export function calculateUrgency(
  service: {
    status: string;
    scheduled_date: string | null;
    scheduled_time_slot: string | null;
    scheduled_time: string | null;
  },
  config: PastDueConfig = DEFAULT_CONFIG,
  now: Date = new Date()
): UrgencyLevel {
  // Delivered services have no urgency
  if (service.status === 'delivered') return 'on_track';

  // Unscheduled services can't be past due
  if (!service.scheduled_date) return 'on_track';

  // Calculate cutoff time
  const cutoff = getCutoffTime(service, config);
  if (!cutoff) return 'on_track';

  // Add grace period
  const graceMinutes = service.scheduled_time_slot === 'specific'
    ? config.gracePeriodSpecific
    : config.gracePeriodStandard;
  const deadline = new Date(cutoff.getTime() + graceMinutes * 60000);

  // Calculate difference in minutes
  const diffMinutes = (deadline.getTime() - now.getTime()) / 60000;

  // Determine urgency level
  if (diffMinutes < -(config.thresholdCriticalHours * 60)) return 'critical';
  if (diffMinutes < 0) return 'past_due';
  if (diffMinutes < config.thresholdUrgent) return 'urgent';
  if (diffMinutes < config.thresholdApproaching) return 'approaching';
  return 'on_track';
}

function getCutoffTime(
  service: {
    scheduled_date: string;
    scheduled_time_slot: string | null;
    scheduled_time: string | null;
  },
  config: PastDueConfig
): Date | null {
  const date = new Date(service.scheduled_date);

  if (service.scheduled_time_slot === 'specific' && service.scheduled_time) {
    const [hours, minutes] = service.scheduled_time.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  const slot = service.scheduled_time_slot as keyof TimeSlotConfig;
  if (slot && config.timeSlots[slot]) {
    const [hours, minutes] = config.timeSlots[slot].end.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  // Default to end of business day
  date.setHours(17, 0, 0, 0);
  return date;
}

export function sortByUrgency<T extends Parameters<typeof calculateUrgency>[0]>(
  services: T[],
  config?: PastDueConfig
): T[] {
  const priority: Record<UrgencyLevel, number> = {
    critical: 0,
    past_due: 1,
    urgent: 2,
    approaching: 3,
    on_track: 4
  };

  return [...services].sort((a, b) => {
    const urgencyA = calculateUrgency(a, config);
    const urgencyB = calculateUrgency(b, config);

    if (priority[urgencyA] !== priority[urgencyB]) {
      return priority[urgencyA] - priority[urgencyB];
    }

    // Secondary sort by scheduled time
    const timeA = a.scheduled_date || '';
    const timeB = b.scheduled_date || '';
    return timeA.localeCompare(timeB);
  });
}
```

---

## 2. Visual Components

### 2.1 Urgency Badge Component

```svelte
<!-- src/lib/components/UrgencyBadge.svelte -->
<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { AlertCircle, Clock, AlertTriangle } from '@lucide/svelte';
  import type { UrgencyLevel } from '$lib/utils/past-due.js';
  import * as m from '$lib/paraglide/messages.js';

  interface Props {
    level: UrgencyLevel;
    size?: 'sm' | 'default';
  }

  let { level, size = 'default' }: Props = $props();

  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0' : '';
  const iconSize = size === 'sm' ? 'size-2.5' : 'size-3';
</script>

{#if level === 'critical'}
  <Badge variant="destructive" class="gap-1 bg-red-700 {sizeClasses}">
    <AlertCircle class={iconSize} />
    {m.urgency_critical()}
  </Badge>
{:else if level === 'past_due'}
  <Badge variant="destructive" class="gap-1 {sizeClasses}">
    <AlertCircle class={iconSize} />
    {m.urgency_past_due()}
  </Badge>
{:else if level === 'urgent'}
  <Badge variant="outline" class="gap-1 border-orange-500 text-orange-600 bg-orange-50 {sizeClasses}">
    <AlertTriangle class={iconSize} />
    {m.urgency_due_soon()}
  </Badge>
{:else if level === 'approaching'}
  <Badge variant="outline" class="gap-1 border-yellow-500 text-yellow-700 bg-yellow-50 {sizeClasses}">
    <Clock class={iconSize} />
    {m.urgency_due_soon()}
  </Badge>
{/if}
```

### 2.2 Integration Points

Show urgency badge on:
- Courier Dashboard (`/courier`) - service cards
- Services List (`/courier/services`) - service cards
- Calendar (`/courier/calendar`) - day detail panel
- Service Detail (`/courier/services/[id]`) - header

### 2.3 Dashboard Sorting

Services sorted by urgency priority:
1. Critical (> 24h overdue)
2. Past Due
3. Urgent (< 1h remaining)
4. Approaching (1-2h remaining)
5. On Track (by scheduled time)

---

## 3. Rescheduling Workflow

### 3.1 Courier-Initiated Reschedule

The courier can reschedule any pending service at any time.

**Flow:**
```
Courier clicks "Reschedule" on service
  -> Dialog opens with date/time picker
  -> Courier selects new date and time slot
  -> Optionally adds reason
  -> Confirms reschedule
  -> Service updated immediately
  -> Client notified (push + email if enabled)
  -> Reschedule recorded in history
```

**No approval needed** - solo courier has full operational control.

### 3.2 Client-Initiated Reschedule

Clients can request schedule changes for their services.

**Configurable policies:**
- `allow_client_reschedule`: Enable/disable client rescheduling
- `client_min_notice_hours`: Minimum hours before scheduled time (default: 24)
- `client_max_reschedules`: Maximum reschedules per service (default: 3)
- `require_approval_on_limit`: Require approval after limit exceeded

**Flow (auto-approve path):**
```
Client clicks "Request Reschedule"
  -> Checks policy: notice >= 24h AND reschedule_count < 3
  -> If passes: auto-approve, update service, notify courier
  -> If fails: submit for approval, notify courier
```

**Flow (approval required path):**
```
Client submits reschedule request
  -> Service marked with pending_reschedule
  -> Courier receives notification
  -> Courier approves or denies
  -> Service updated (if approved)
  -> Client notified of decision
```

### 3.3 Batch Rescheduling

Courier can reschedule multiple services at once (e.g., sick day).

**Flow:**
```
Courier selects multiple services from dashboard
  -> Clicks "Reschedule Selected"
  -> Picks target date (or "next business day")
  -> Optionally keeps same time slots or assigns new
  -> Confirms batch operation
  -> All services updated
  -> Affected clients notified (grouped by client)
```

### 3.4 Reschedule Dialog Component

```svelte
<!-- src/lib/components/RescheduleDialog.svelte -->
<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import SchedulePicker from '$lib/components/SchedulePicker.svelte';
  import * as m from '$lib/paraglide/messages.js';
  import type { Service, TimeSlot } from '$lib/database.types.js';

  interface Props {
    service: Service;
    open: boolean;
    onReschedule: (date: string, timeSlot: TimeSlot, reason?: string) => Promise<void>;
  }

  let { service, open = $bindable(), onReschedule }: Props = $props();

  let newDate = $state<string | null>(null);
  let newTimeSlot = $state<TimeSlot | null>(null);
  let newTime = $state<string | null>(null);
  let reason = $state('');
  let loading = $state(false);

  async function handleSubmit() {
    if (!newDate || !newTimeSlot) return;
    loading = true;
    await onReschedule(newDate, newTimeSlot, reason || undefined);
    loading = false;
    open = false;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{m.reschedule_title()}</Dialog.Title>
      <Dialog.Description>
        {m.reschedule_description()}
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <!-- Current schedule -->
      <div class="rounded-lg bg-muted p-3 text-sm">
        <p class="font-medium">{m.reschedule_current()}</p>
        <p class="text-muted-foreground">
          {service.scheduled_date} - {service.scheduled_time_slot}
        </p>
      </div>

      <!-- New schedule picker -->
      <SchedulePicker
        bind:selectedDate={newDate}
        bind:selectedTimeSlot={newTimeSlot}
        bind:selectedTime={newTime}
      />

      <!-- Optional reason -->
      <div class="space-y-2">
        <label class="text-sm font-medium">{m.reschedule_reason()}</label>
        <Textarea
          bind:value={reason}
          placeholder={m.reschedule_reason_placeholder()}
          rows={2}
        />
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => open = false}>
        {m.action_cancel()}
      </Button>
      <Button
        onclick={handleSubmit}
        disabled={!newDate || !newTimeSlot || loading}
      >
        {loading ? m.saving() : m.reschedule_confirm()}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

---

## 4. Notifications

### 4.1 Notification Types

| Type | Recipient | Trigger | Priority |
|------|-----------|---------|----------|
| `past_due_alert` | Courier | Service becomes past due | High |
| `past_due_reminder` | Courier | Periodic reminder (configurable) | Normal |
| `approaching_deadline` | Courier | Service entering urgent window | Normal |
| `reschedule_by_courier` | Client | Courier reschedules service | Normal |
| `reschedule_request` | Courier | Client requests reschedule | Normal |
| `reschedule_approved` | Client | Courier approves request | Normal |
| `reschedule_denied` | Client | Courier denies request | Normal |
| `daily_summary` | Courier | Morning summary of day's work | Low |

### 4.2 Notification Content

**Past Due Alert (Courier):**
```
Title: Delivery Past Due
Body: [Client Name] at [Location] was scheduled for [Time Slot].
      Now [X hours/minutes] overdue.
Actions: [View] [Reschedule]
```

**Reschedule Notification (Client):**
```
Title: Delivery Rescheduled
Body: Your delivery has been moved from [Old Date/Time] to [New Date/Time].
      Reason: [Reason if provided]
Actions: [View Details]
```

### 4.3 Notification Preferences

Configurable per-user:
- Push notifications on/off (existing)
- Email notifications on/off (existing)
- Past due reminder interval (new)
- Daily summary enabled/time (new)

### 4.4 Fatigue Prevention

- Max 1 past due reminder per service per hour
- Bundle multiple past due alerts into single notification
- Suppress push if user actively viewing dashboard
- Daily summary replaces individual "approaching" alerts

---

## 5. Data Model

### 5.1 Services Table Changes

```sql
-- Add reschedule tracking fields
ALTER TABLE services ADD COLUMN IF NOT EXISTS
  reschedule_count integer DEFAULT 0;

ALTER TABLE services ADD COLUMN IF NOT EXISTS
  last_rescheduled_at timestamptz;

ALTER TABLE services ADD COLUMN IF NOT EXISTS
  last_rescheduled_by uuid REFERENCES profiles(id);

ALTER TABLE services ADD COLUMN IF NOT EXISTS
  pending_reschedule_date date;

ALTER TABLE services ADD COLUMN IF NOT EXISTS
  pending_reschedule_time_slot text;

ALTER TABLE services ADD COLUMN IF NOT EXISTS
  pending_reschedule_requested_at timestamptz;

-- Index for efficient past-due queries
CREATE INDEX IF NOT EXISTS idx_services_scheduled
  ON services(scheduled_date, scheduled_time_slot, status)
  WHERE deleted_at IS NULL;
```

### 5.2 Reschedule History Table

```sql
CREATE TABLE IF NOT EXISTS service_reschedule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES services(id) ON DELETE CASCADE NOT NULL,

  -- Who initiated
  initiated_by uuid REFERENCES profiles(id) NOT NULL,
  initiated_by_role text NOT NULL CHECK (initiated_by_role IN ('courier', 'client')),

  -- What changed
  old_date date,
  old_time_slot text,
  old_time time,
  new_date date NOT NULL,
  new_time_slot text NOT NULL,
  new_time time,

  -- Context
  reason text,

  -- Approval (for client-initiated)
  approval_status text DEFAULT 'auto_approved'
    CHECK (approval_status IN ('auto_approved', 'pending', 'approved', 'denied')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  denial_reason text,

  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_reschedule_history_service
  ON service_reschedule_history(service_id);
CREATE INDEX idx_reschedule_history_pending
  ON service_reschedule_history(approval_status)
  WHERE approval_status = 'pending';

-- RLS
ALTER TABLE service_reschedule_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY reschedule_history_select ON service_reschedule_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'courier'
    )
    OR EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_reschedule_history.service_id
      AND s.client_id = auth.uid()
    )
  );

CREATE POLICY reschedule_history_insert ON service_reschedule_history
  FOR INSERT WITH CHECK (initiated_by = auth.uid());
```

### 5.3 Courier Settings Extension

Add to `profiles` table or create separate `courier_settings` table:

```sql
-- Option A: Add to profiles (simpler for single courier)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  past_due_settings jsonb DEFAULT '{
    "gracePeriodStandard": 30,
    "gracePeriodSpecific": 15,
    "thresholdApproaching": 120,
    "thresholdUrgent": 60,
    "thresholdCriticalHours": 24,
    "pastDueReminderInterval": 60,
    "dailySummaryEnabled": true,
    "dailySummaryTime": "08:00",
    "allowClientReschedule": true,
    "clientMinNoticeHours": 24,
    "clientMaxReschedules": 3,
    "requireApprovalOnLimit": true
  }'::jsonb;
```

### 5.4 TypeScript Types

```typescript
// Add to src/lib/database.types.ts

export type UrgencyLevel = 'on_track' | 'approaching' | 'urgent' | 'past_due' | 'critical';

export type RescheduleApprovalStatus = 'auto_approved' | 'pending' | 'approved' | 'denied';

export type ServiceRescheduleHistory = {
  id: string;
  service_id: string;
  initiated_by: string;
  initiated_by_role: 'courier' | 'client';
  old_date: string | null;
  old_time_slot: TimeSlot | null;
  old_time: string | null;
  new_date: string;
  new_time_slot: TimeSlot;
  new_time: string | null;
  reason: string | null;
  approval_status: RescheduleApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  denial_reason: string | null;
  created_at: string;
};

export type PastDueSettings = {
  gracePeriodStandard: number;
  gracePeriodSpecific: number;
  thresholdApproaching: number;
  thresholdUrgent: number;
  thresholdCriticalHours: number;
  pastDueReminderInterval: number;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
  allowClientReschedule: boolean;
  clientMinNoticeHours: number;
  clientMaxReschedules: number;
  requireApprovalOnLimit: boolean;
};
```

---

## 6. Settings UI

### 6.1 Courier Settings Page Additions

Add new section to `/courier/settings`:

**"Delivery Deadlines" section:**
- Grace period (standard): slider 0-60 min
- Grace period (specific time): slider 0-30 min
- "Approaching" threshold: slider 30-180 min
- "Urgent" threshold: slider 15-120 min

**"Client Rescheduling" section:**
- Allow clients to reschedule: toggle
- Minimum notice required: input (hours)
- Maximum reschedules per service: input
- Require approval after limit: toggle

**"Notifications" section (extend existing):**
- Past due reminder interval: dropdown (15/30/60 min, off)
- Daily summary: toggle + time picker

---

## 7. Implementation Phases

### Phase 1: Core Past Due Display (MVP)
**Goal:** Show past due status to courier

- [ ] Create `src/lib/utils/past-due.ts` with detection logic
- [ ] Create `UrgencyBadge.svelte` component
- [ ] Add urgency badges to courier dashboard
- [ ] Add urgency badges to services list
- [ ] Add urgency sorting to dashboard
- [ ] Add i18n messages (en + pt-PT)

**Files:**
- Create: `src/lib/utils/past-due.ts`
- Create: `src/lib/components/UrgencyBadge.svelte`
- Modify: `src/routes/courier/+page.svelte`
- Modify: `src/routes/courier/services/+page.svelte`
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

### Phase 2: Courier Reschedule
**Goal:** Enable courier to reschedule with client notification

- [ ] Create `RescheduleDialog.svelte` component
- [ ] Add reschedule action to service detail page
- [ ] Create reschedule API endpoint/action
- [ ] Send notification to client on reschedule
- [ ] Add reschedule history tracking (basic)

**Database:**
- Migration: Add `reschedule_count`, `last_rescheduled_at`, `last_rescheduled_by` to services

**Files:**
- Create: `src/lib/components/RescheduleDialog.svelte`
- Modify: `src/routes/courier/services/[id]/+page.svelte`
- Modify: `src/routes/courier/services/[id]/+page.server.ts`

### Phase 3: Settings & Configuration
**Goal:** Make thresholds and policies configurable

- [ ] Add past due settings to courier settings page
- [ ] Load settings in layout and pass to detection logic
- [ ] Persist settings to database

**Database:**
- Migration: Add `past_due_settings` JSONB column to profiles

**Files:**
- Modify: `src/routes/courier/settings/+page.svelte`
- Modify: `src/routes/courier/+layout.server.ts`
- Modify: `src/lib/utils/past-due.ts` (accept config param)

### Phase 4: Client Reschedule Workflow
**Goal:** Allow clients to request reschedules

- [ ] Add reschedule request button to client service view
- [ ] Create approval/denial workflow for courier
- [ ] Add pending reschedule badge to courier requests page
- [ ] Create reschedule history table
- [ ] Full audit trail

**Database:**
- Migration: Create `service_reschedule_history` table
- Migration: Add `pending_reschedule_*` columns to services

**Files:**
- Modify: `src/routes/client/services/[id]/+page.svelte`
- Modify: `src/routes/courier/requests/+page.svelte`
- Create: Reschedule approval components

### Phase 5: Advanced Features
**Goal:** Batch operations and notifications

- [ ] Batch reschedule UI
- [ ] Past due notifications (push)
- [ ] Daily summary notification
- [ ] Notification fatigue prevention

---

## 8. API Endpoints

### 8.1 Reschedule Service (Courier)

```typescript
// POST /courier/services/[id]?/reschedule
export const actions = {
  reschedule: async ({ request, locals, params }) => {
    const formData = await request.formData();
    const newDate = formData.get('date') as string;
    const newTimeSlot = formData.get('time_slot') as TimeSlot;
    const reason = formData.get('reason') as string | null;

    // Update service
    // Record history
    // Send notification to client
    // Return success
  }
};
```

### 8.2 Request Reschedule (Client)

```typescript
// POST /client/services/[id]?/request-reschedule
export const actions = {
  requestReschedule: async ({ request, locals, params }) => {
    // Check policy (notice, count limits)
    // If auto-approve: update service, notify courier
    // If approval needed: set pending, notify courier
  }
};
```

### 8.3 Approve/Deny Reschedule (Courier)

```typescript
// POST /courier/requests?/approve-reschedule
// POST /courier/requests?/deny-reschedule
```

---

## 9. Testing Checklist

### Phase 1
- [ ] Urgency calculation with all time slots
- [ ] Urgency badge renders correctly for each level
- [ ] Services sorted by urgency on dashboard
- [ ] Past due detection works across midnight
- [ ] Grace period applied correctly

### Phase 2
- [ ] Courier can reschedule any pending service
- [ ] Client receives notification on reschedule
- [ ] Reschedule count incremented
- [ ] Cannot reschedule delivered services

### Phase 3
- [ ] Settings persist and load correctly
- [ ] Custom thresholds affect urgency calculation
- [ ] Settings UI validates input ranges

### Phase 4
- [ ] Client can request reschedule within policy
- [ ] Request goes to approval when policy exceeded
- [ ] Courier can approve/deny requests
- [ ] History recorded for all reschedules

---

## 10. Future Considerations

- **Cascade detection**: When one delivery is late, flag subsequent deliveries that may be affected
- **Smart suggestions**: Suggest optimal reschedule dates based on route density
- **Client self-service limits**: Per-client override of reschedule policies
- **Analytics**: Track on-time delivery rate, common reschedule reasons
- **Calendar integration**: Sync with Google/Apple calendar for client visibility
