# Notification Center Design

**Date:** 2026-01-26
**Status:** Ready for Implementation
**Author:** Claude + Filipe
**Reviewed by:** DHH-reviewer, Kieran-reviewer, Simplicity-reviewer

## Overview

Redesign bareCourier's notification system to support multi-channel delivery (in-app, push, email) with granular per-category preferences, quiet hours, and an enhanced notification dropdown UI.

## Goals

1. **Channel gaps** - Enable push/email for important events (past due alerts, new requests)
2. **Granular control** - Per-category × per-channel settings matrix
3. **Better UX** - Enhanced dropdown with tabs, time grouping, and quick settings access
4. **Respect boundaries** - Quiet hours and working days filtering

## Non-Goals

- Full dedicated notifications page (keep enhanced dropdown)
- Swipe gestures in dropdown (too complex for PWA)
- Real-time preference sync across devices (use page reload)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION CENTER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   In-App     │    │    Push      │    │    Email     │      │
│  │  (existing)  │    │  (web-push)  │    │   (Resend)   │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │  Notification   │                          │
│                    │  Preferences    │                          │
│                    │    (per-user)   │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │               │
│  ┌──────▼───────┐   ┌───────▼──────┐   ┌───────▼──────┐        │
│  │  Category    │   │ Quiet Hours  │   │ Working Days │        │
│  │   Matrix     │   │  Filter      │   │   Filter     │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### New `notification_preferences` column on `profiles`

```typescript
type NotificationPreferences = {
  // Per-category channel settings
  categories: {
    new_request:     { inApp: boolean; push: boolean; email: boolean };
    schedule_change: { inApp: boolean; push: boolean; email: boolean };
    past_due:        { inApp: boolean; push: boolean; email: boolean };
    daily_summary:   { inApp: boolean; push: boolean; email: boolean };
    service_status:  { inApp: boolean; push: boolean; email: boolean };
  };
  // Quiet hours (push/email only, in-app always allowed)
  quietHours: {
    enabled: boolean;
    start: string;  // "21:00"
    end: string;    // "08:00"
  };
  // Use existing working_days from profile
  workingDaysOnly: boolean;
};
```

### Default Values

| Category | In-App | Push | Email |
|----------|--------|------|-------|
| New requests | ✓ | ✓ | ✓ |
| Schedule changes | ✓ | ✓ | ✗ |
| Past due alerts | ✓ | ✓ | ✗ |
| Daily summary | ✓ | ✗ | ✓ |
| Service status (client) | ✓ | ✗ | ✓ |

---

## UI Design

### Enhanced Notification Dropdown

```
┌─────────────────────────────────────────┐
│ Notifications                      ⚙️   │  ← Settings link
├─────────────────────────────────────────┤
│ [All] [Requests] [Alerts]    ○ Unread   │  ← Category tabs + filter
├─────────────────────────────────────────┤
│ TODAY                                   │  ← Time grouping
├─────────────────────────────────────────┤
│ 🔔 New request from Café Lisboa    •    │
│    Pickup: Rua Augusta → Baixa          │
│    2 min ago                            │
├─────────────────────────────────────────┤
│ ⚠️ Entrega Atrasada                 •    │
│    Padaria Central - 30 min atrasada    │
│    15 min ago                           │
├─────────────────────────────────────────┤
│ EARLIER                                 │
├─────────────────────────────────────────┤
│ 📦 Service Delivered                    │
│    Farmácia São João                    │
│    Yesterday                            │
├─────────────────────────────────────────┤
│           Mark all as read              │
└─────────────────────────────────────────┘
```

**Tab Mapping:**

| Tab | Notification Types |
|-----|-------------------|
| All | Everything |
| Requests | `new_request`, `schedule_change` |
| Alerts | `past_due`, `service_status`, `daily_summary` |

### Notification Settings UI (NotificationsTab)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔔 Notification Channels                                        │
├─────────────────────────────────────────────────────────────────┤
│ Push Notifications              [Toggle]                        │
│ Email Notifications             [Toggle]                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 📋 Notification Preferences                                     │
├─────────────────────────────────────────────────────────────────┤
│                              In-App    Push    Email            │
│ ─────────────────────────────────────────────────────────────── │
│ 📦 New service requests          ✓       ✓       ✓             │
│ 📅 Schedule changes              ✓       ✓       ○             │
│ ⚠️ Past due alerts               ✓       ✓       ○             │
│ 📊 Daily summary                 ✓       ○       ✓             │
│                                         [Save Preferences]      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 🌙 Quiet Hours                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Enable quiet hours              [Toggle]                        │
│   From: [21:00]      To: [08:00]                                │
│ ☑️ Only notify on working days                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Implementation

### Notification Dispatch Flow

```
Event Occurs (new request, past due, etc.)
            │
            ▼
  ┌─────────────────────┐
  │ Load user's prefs   │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ Check quiet hours   │
  │ Check working day   │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────────────────────────────┐
  │  ✓ In-App  → Always insert to notifications │
  │  ? Push    → If enabled & not quiet hours   │
  │  ? Email   → If enabled & not quiet hours   │
  └─────────────────────────────────────────────┘
```

### Edge Function Changes

| Function | Current | New |
|----------|---------|-----|
| `check-past-due` | In-app only | + dispatch push/email per prefs |
| `daily-summary` | In-app only | + dispatch push/email per prefs |
| Server Actions | Mixed | + respect category preferences |

### Shared Helper

```typescript
// supabase/functions/_shared/notify.ts

type NotificationCategory =
  | 'new_request'
  | 'schedule_change'
  | 'past_due'
  | 'daily_summary'
  | 'service_status';

type DispatchResult = {
  inApp: { success: boolean; notificationId?: string };
  push: { success: boolean; error?: string } | null;  // null = not attempted
  email: { success: boolean; error?: string } | null;
};

export async function dispatchNotification({
  supabase,
  userId,
  category,
  title,
  message,
  serviceId?,
  emailTemplate?,
  emailData?
}): Promise<DispatchResult> {
  // 1. Load user profile with notification_preferences, timezone, working_days
  // 2. Check if within quiet hours (handles midnight-spanning)
  // 3. Check if today is a working day (if workingDaysOnly enabled)
  // 4. Always create in-app notification
  // 5. If push enabled for category & not quiet → send push
  // 6. If email enabled for category & not quiet → send email
  // 7. Return result with success/failure for each channel
}

/**
 * Check if current time is within quiet hours.
 * Handles midnight-spanning ranges (e.g., 21:00 to 08:00).
 */
export function isWithinQuietHours(
  now: Date,
  start: string,  // "21:00"
  end: string,    // "08:00"
  timezone: string
): boolean {
  // Convert current time to user's timezone
  const localTime = now.toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const [nowHour, nowMin] = localTime.split(':').map(Number);
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);

  const nowMinutes = nowHour * 60 + nowMin;
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (startMinutes <= endMinutes) {
    // Normal range (e.g., 09:00 to 17:00)
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  } else {
    // Midnight-spanning range (e.g., 21:00 to 08:00)
    // Quiet if: after start OR before end
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
}
```

---

## Database Migration

```sql
-- Migration: Add notification preferences to profiles

-- 1. Add notification_preferences column
ALTER TABLE profiles
ADD COLUMN notification_preferences JSONB DEFAULT '{
  "categories": {
    "new_request": {"inApp": true, "push": true, "email": true},
    "schedule_change": {"inApp": true, "push": true, "email": false},
    "past_due": {"inApp": true, "push": true, "email": false},
    "daily_summary": {"inApp": true, "push": false, "email": true},
    "service_status": {"inApp": true, "push": false, "email": true}
  },
  "quietHours": {
    "enabled": false,
    "start": "21:00",
    "end": "08:00"
  },
  "workingDaysOnly": true
}';

-- 2. BACKFILL existing profiles with default preferences
UPDATE profiles
SET notification_preferences = '{
  "categories": {
    "new_request": {"inApp": true, "push": true, "email": true},
    "schedule_change": {"inApp": true, "push": true, "email": false},
    "past_due": {"inApp": true, "push": true, "email": false},
    "daily_summary": {"inApp": true, "push": false, "email": true},
    "service_status": {"inApp": true, "push": false, "email": true}
  },
  "quietHours": {
    "enabled": false,
    "start": "21:00",
    "end": "08:00"
  },
  "workingDaysOnly": true
}'::jsonb
WHERE notification_preferences IS NULL;

-- 3. Update notification type constraint to include new categories
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'service_status',
  'new_request',
  'schedule_change',
  'service_created',
  'past_due',
  'daily_summary'
));
```

---

## Implementation Tasks

### Phase 1: Foundation
- [x] Database migration (notification_preferences column + backfill)
- [x] TypeScript types for NotificationPreferences in `src/lib/database.types.ts`
- [x] Update notification type union in `database.types.ts` to include `'past_due' | 'daily_summary'`
- [x] Update DEFAULT constants in `src/lib/constants/scheduling.ts`

### Phase 2: Settings UI
- [x] Expand NotificationsTab with channel matrix
- [x] Add quiet hours section
- [x] Add working days checkbox
- [x] Server action to save preferences
- [x] i18n keys for new labels

### Phase 3: Enhanced Dropdown
- [x] Add category tabs to NotificationBell
- [x] Add time grouping (Today/Earlier)
- [x] Add unread filter toggle
- [x] Add settings gear icon link
- [x] Update notification type icons

### Phase 4: Backend Integration
- [x] Create shared dispatchNotification helper
- [x] Update check-past-due to use dispatcher
- [x] Update daily-summary to use dispatcher
- [x] Server action respects preferences (updateNotificationPreferences handles JSONB)
- [ ] Test quiet hours logic (manual)
- [ ] Test working days filter (manual)

### Phase 5: Testing & Polish
- [x] TypeScript check passes (0 errors)
- [x] Production build succeeds
- [ ] Test push delivery (requires VAPID keys)
- [ ] Test email delivery (requires Resend keys)
- [ ] Mobile responsive testing (manual)

---

## References

- [Smashing Magazine - Notification UX Guidelines](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/)
- [Toptal - Notification Design Guide](https://www.toptal.com/designers/ux/notification-design)
- [UXCam - Push Notification Guide 2025](https://uxcam.com/blog/push-notification-guide/)
- Android notification channels pattern (granular control)
- Existing bareCourier patterns: `past_due_settings` JSONB, `NotificationBell.svelte`

---

## Resolved Questions

1. **Should clients have the same level of granular control?**
   → Yes, clients get full parity with same level of control as courier.

2. **Do we need notification history beyond the 20-item dropdown limit?**
   → No, keep current limit. Revisit if users complain.

3. **Should quiet hours affect in-app notifications too?**
   → No, quiet hours only affect push/email. In-app notifications always allowed (user can check when ready).

## Addressed Gaps (from code review)

1. ✅ **TypeScript types** - Added `past_due` and `daily_summary` to notification type union
2. ✅ **Migration backfill** - Added UPDATE statement to backfill existing profiles
3. ✅ **Quiet hours midnight logic** - Added `isWithinQuietHours()` helper that handles midnight-spanning ranges
4. ✅ **Push permission UI** - Already implemented in existing NotificationsTab
