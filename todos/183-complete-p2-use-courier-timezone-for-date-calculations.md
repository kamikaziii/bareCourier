---
status: complete
priority: p2
issue_id: "183"
tags: [bug, timezone, data-accuracy, code-review]
dependencies: []
---

# Use Courier's Timezone Setting for Today/Tomorrow Calculation

## Problem Statement

The requests page calculates "today" and "tomorrow" using server time instead of the courier's configured timezone. The `profiles.timezone` field exists and is configurable in settings, but is not used in the workload date calculations.

## Findings

- **Location:** `src/routes/courier/requests/+page.server.ts:66-89`
- Line 68 only fetches `workload_settings`, not `timezone`
- Lines 84-89 use `new Date().toISOString()` which converts to UTC
- Courier's timezone setting (stored in `profiles.timezone`) is ignored
- If server runs in different timezone than courier, "today" label may be wrong

## Proposed Solutions

### Option 1: Use courier's timezone from profile (Recommended)

```typescript
// Change line 68 to also fetch timezone:
.select('workload_settings, timezone')

// Use timezone for date calculations:
const tz = courierProfile?.timezone || 'Europe/Lisbon';
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz });
const todayStr = formatter.format(new Date());

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = formatter.format(tomorrow);
```

- **Pros**: Respects user's configured timezone, consistent with settings
- **Cons**: Slightly more complex date handling
- **Effort**: Small (< 1 hour)
- **Risk**: Low

## Recommended Action

Update the profile query to include timezone and use `Intl.DateTimeFormat` for date string generation.

## Technical Details

- **Affected Files**: `src/routes/courier/requests/+page.server.ts`
- **Related Components**: Workload date calculations, nextCompatibleDay search
- **Database Changes**: No (timezone field already exists)

## Acceptance Criteria

- [ ] Profile query fetches `timezone` alongside `workload_settings`
- [ ] Today/tomorrow strings use courier's timezone
- [ ] Default to 'Europe/Lisbon' if timezone not set
- [ ] nextCompatibleDay loop also uses correct timezone
- [ ] Build passes

## Work Log

### 2026-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue identified from Greptile code review on PR #6
- Verified courier has timezone setting that's not being used
- Status: ready

## Notes

Source: Greptile code review on PR #6 - timezone mismatch finding
