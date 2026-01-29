# Courier Workload Management System

**Date**: 2026-01-28
**Status**: Design Complete
**Author**: Brainstorming session with user

---

## Overview

A workload estimation system that helps the courier understand if their day's services can realistically fit within their working hours. The system calculates total work time needed, compares it against available capacity, and learns from actual delivery times to improve estimates over time.

### Core Formula

```
Total work time = Driving time + (Service time × stops) + Break time
Available capacity = Daily hours - Scheduled breaks
```

### Data Sources

| Factor | Source |
|--------|--------|
| Driving time | OpenRouteService API (already implemented) |
| Service time | Configurable default, improved via learning |
| Breaks | Auto lunch slot + manual toggle |

---

## Components

### 1. Dashboard Workload Card

New card on courier dashboard showing today's workload at a glance.

**Design**:
```
┌─────────────────────────────────────┐
│  📊 Today's Workload                │
├─────────────────────────────────────┤
│  6 services  •  42 km total         │
│                                     │
│  Driving      2h 15m                │
│  Service time 1h 30m (6 × 15 min)   │
│  Lunch        1h 00m                │
│  ─────────────────────              │
│  Total needed 4h 45m                │
│                                     │
│  ✅ Fits in 8h day (3h 15m buffer)  │
└─────────────────────────────────────┘
```

**Warning States**:
- `✅ Fits in Xh day` — Green, comfortable buffer
- `⚠️ Tight day` — Yellow, less than 1h buffer
- `🔴 Overloaded` — Red, exceeds available hours

**Interactive**: Tapping the card expands to show per-service breakdown with individual driving times and service time estimates.

---

### 2. Mini Status Bar (Mobile)

Thin status bar at top of mobile app showing work status.

**Working State**:
```
┌─────────────────────────────────────┐
│ 🟢 Working                  12:34 PM│
└─────────────────────────────────────┘
```

**On Break State**:
```
┌─────────────────────────────────────┐
│ 🍴 On Break (23 min)           Tap  │
└─────────────────────────────────────┘
```

**Behavior**:
- Tap to toggle between Working / On Break
- Shows elapsed break time when on break
- Desktop: Same status in header area

---

### 3. Break Tracking System

Three-layer system ensuring breaks are always captured.

#### Layer 1: Auto Lunch Prompt

At configured lunch start time, push notification + in-app prompt:

```
┌─────────────────────────────────────┐
│  🍴 It's lunch time                 │
│                                     │
│  Taking a break?                    │
│                                     │
│  [Yes, start break]  [No, working]  │
└─────────────────────────────────────┘
```

- **Yes** → Status changes to "On Break"
- **No** → Continues as "Working"
- **Ignored** → Continues as "Working" (safe default)

#### Layer 2: Manual Toggle

Mini status bar allows manual break toggle at any time.

#### Layer 3: Safety Nets

**Anomaly Prompt**: If gap between deliveries exceeds expected time + 30 min threshold:

```
┌─────────────────────────────────────┐
│  🤔 Long gap detected               │
├─────────────────────────────────────┤
│  Previous delivery: 10:32 AM        │
│  This delivery: 12:15 PM            │
│  Expected: ~35 min  •  Actual: 1h43m│
│                                     │
│  What happened?                     │
│                                     │
│  [🍴 Break]        [🚗 Traffic]     │
│  [👤 Customer]     [⋯ Other]        │
└─────────────────────────────────────┘
```

**Daily Review**: End-of-day summary showing timeline with unresolved gaps.

---

### 4. Daily Review

End-of-day summary for reviewing and correcting the day's timeline.

**Trigger**: Push notification at configured time (e.g., 6:00 PM)

**Access Points** (if notification dismissed):
1. In-app notification bell — persists until reviewed
2. Dashboard card — shows "Review yesterday" banner

**Screen Design**:
```
┌─────────────────────────────────────┐
│  📋 Daily Review — Jan 28           │
├─────────────────────────────────────┤
│  8 services completed               │
│  Total time: 6h 23m                 │
│                                     │
│  Timeline:                          │
│  ─────────────────────────────────  │
│  09:15  ✅ Service #1 (12 min)      │
│  09:42  ✅ Service #2 (18 min)      │
│  10:31  ⚠️ Gap (47 min) [Mark...]   │
│  11:18  ✅ Service #3 (15 min)      │
│  12:00  🍴 Lunch (1h confirmed)     │
│  13:15  ✅ Service #4 (14 min)      │
│  ...                                │
├─────────────────────────────────────┤
│  [Save & Close]                     │
└─────────────────────────────────────┘
```

**Gap Actions**: Tapping "Mark..." opens 4-option picker (Break / Traffic / Customer / Other).

---

### 5. Learning System

Service time estimates improve over time based on actual delivery data.

**Data Collected Per Delivery**:
```
- delivery_id
- started_at (previous delivery timestamp or day start)
- completed_at (marked as delivered)
- driving_time_estimate (from OpenRouteService)
- break_time (from break logs in this window)
- delay_reason (if anomaly prompt was triggered)
```

**Service Time Calculation**:
```
actual_service_time = (completed_at - started_at) - driving_time - break_time
```

**Learning Rules**:
| Delay Reason | Include in Learning? |
|--------------|---------------------|
| NULL (no prompt) | ✅ Yes |
| Customer | ✅ Yes (waiting is part of delivery) |
| Break | ❌ No |
| Traffic | ❌ No |
| Other | ❌ No |

**Running Average**:
- Rolling average of last 50 deliveries
- Recent deliveries weighted higher
- Visible in settings: "Current estimate: 14 min (based on 47 deliveries)"
- Fallback: Uses configured default (15 min) if <10 deliveries

---

### 6. RouteMap Enhancement

Display driving duration alongside distance.

**Current**:
```
Distance: 4.2 km                    [Get Directions →]
```

**New**:
```
4.2 km • ~18 min                    [Get Directions →]
```

**Implementation**: Pass `durationMinutes` through from `calculateRoute()` (already returned by OpenRouteService, just not displayed).

---

## Settings

New "Workload" section in courier settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Daily work hours | Number (hours) | 8 | Total available capacity per day |
| Default service time | Number (minutes) | 15 | Estimated time per stop |
| Auto lunch time | Time range | 12:00-13:00 | When to prompt for lunch break |
| End of day review | Time | 18:00 | When to send daily review notification |
| Learn from deliveries | Toggle | On | Improve estimates from actual times |

---

## Database Schema

### New Tables

#### `break_logs`
```sql
CREATE TABLE break_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  type TEXT NOT NULL CHECK (type IN ('lunch', 'manual', 'retroactive')),
  source TEXT NOT NULL CHECK (source IN ('auto', 'toggle', 'anomaly_prompt', 'daily_review')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `delivery_time_logs`
```sql
CREATE TABLE delivery_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  courier_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  driving_time_minutes INTEGER,
  break_time_minutes INTEGER DEFAULT 0,
  delay_reason TEXT CHECK (delay_reason IN ('break', 'traffic', 'customer', 'other')),
  calculated_service_time_minutes INTEGER,
  include_in_learning BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `daily_reviews`
```sql
CREATE TABLE daily_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  review_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  total_services INTEGER,
  total_work_minutes INTEGER,
  gaps_detected INTEGER,
  gaps_resolved INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(courier_id, review_date)
);
```

### Profile Extensions

Add to `profiles` table:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workload_settings JSONB DEFAULT '{
  "daily_hours": 8,
  "default_service_time_minutes": 15,
  "auto_lunch_start": "12:00",
  "auto_lunch_end": "13:00",
  "review_time": "18:00",
  "learning_enabled": true,
  "learned_service_time_minutes": null,
  "learning_sample_count": 0
}'::jsonb;
```

---

## API Changes

### Existing: `calculateRoute()` in `distance.ts`

Already returns `durationMinutes` — just need to pipe it through to UI.

### New: Workload Calculation Service

```typescript
// src/lib/services/workload.ts

interface WorkloadEstimate {
  totalServices: number;
  totalDistanceKm: number;
  drivingTimeMinutes: number;
  serviceTimeMinutes: number;
  breakTimeMinutes: number;
  totalTimeMinutes: number;
  availableMinutes: number;
  bufferMinutes: number;
  status: 'comfortable' | 'tight' | 'overloaded';
}

export async function calculateDayWorkload(
  courierId: string,
  date: Date,
  supabase: SupabaseClient
): Promise<WorkloadEstimate>;
```

### New: Break Management

```typescript
// src/lib/services/breaks.ts

export async function startBreak(courierId: string, type: 'lunch' | 'manual'): Promise<void>;
export async function endBreak(courierId: string): Promise<void>;
export async function getCurrentBreak(courierId: string): Promise<Break | null>;
export async function logRetroactiveBreak(
  courierId: string,
  startedAt: Date,
  endedAt: Date,
  source: 'anomaly_prompt' | 'daily_review'
): Promise<void>;
```

---

## UI Components

### New Components

| Component | Location | Description |
|-----------|----------|-------------|
| `WorkloadCard.svelte` | `$lib/components/` | Dashboard workload summary |
| `WorkStatusBar.svelte` | `$lib/components/` | Mini status bar for mobile |
| `AnomalyPrompt.svelte` | `$lib/components/` | Long gap detection dialog |
| `DailyReview.svelte` | `$lib/components/` | End-of-day review screen |
| `BreakToggle.svelte` | `$lib/components/` | Break on/off toggle button |

### Modified Components

| Component | Changes |
|-----------|---------|
| `RouteMap.svelte` | Add duration display alongside distance |
| `AppShell.svelte` | Add WorkStatusBar for mobile |
| `MobileBottomNav.svelte` | No changes (status bar is separate) |

### New Routes

| Route | Description |
|-------|-------------|
| `/courier/review/[date]` | Daily review page |

---

## Notifications

### Push Notifications

| Trigger | Message | Action |
|---------|---------|--------|
| Auto lunch time | "It's lunch time. Taking a break?" | Opens lunch prompt |
| End of day review | "Time to review your day — X gaps detected" | Opens daily review |

### In-App Notifications

| Type | Persists Until | Description |
|------|----------------|-------------|
| Daily review pending | Review completed | "Review your day" in notification bell |

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Database migrations (break_logs, delivery_time_logs, daily_reviews)
- [ ] Profile workload_settings extension
- [ ] Workload calculation service
- [ ] RouteMap duration display

### Phase 2: Break Tracking
- [ ] WorkStatusBar component (mobile)
- [ ] Header status (desktop)
- [ ] Break toggle functionality
- [ ] Auto lunch prompt

### Phase 3: Dashboard Integration
- [ ] WorkloadCard component
- [ ] Per-service breakdown expansion
- [ ] Warning states (comfortable/tight/overloaded)

### Phase 4: Anomaly Detection
- [ ] AnomalyPrompt component
- [ ] Gap detection logic (on delivery completion)
- [ ] Delay reason logging

### Phase 5: Daily Review
- [ ] DailyReview component
- [ ] Review page route
- [ ] Push notification at configured time
- [ ] In-app notification integration
- [ ] Dashboard "review yesterday" banner

### Phase 6: Learning System
- [ ] Delivery time logging on completion
- [ ] Running average calculation
- [ ] Settings display of learned estimate
- [ ] Learning toggle

---

## Open Questions

None — all questions resolved during brainstorming.

---

## References

- [OpenRouteService API](https://openrouteservice.org/) — driving time/distance
- [FarEye - Delivery Exceptions](https://fareye.com/resources/blogs/delivery-exception) — delay reason categories
- [Routific - Delivery Route Planning](https://www.routific.com/blog/what-is-a-delivery-exception) — industry practices
- [DispatchTrack - Fleet Management](https://www.dispatchtrack.com/blog/route-optimization-guide/) — workload estimation patterns
