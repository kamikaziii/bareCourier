---
status: ready
priority: p3
issue_id: "050"
tags: [code-review, security, authorization]
dependencies: []
---

# Missing Role Checks in Settings Server Actions

## Problem Statement

Multiple settings server actions in `/src/routes/courier/settings/+page.server.ts` verify authentication but don't verify the courier role. While the `/courier/*` routes have layout-level protection, a malicious client could craft direct POST requests to these endpoints.

## Findings

**Location:** `src/routes/courier/settings/+page.server.ts`

**Affected Actions (with authentication but NO role check):**
1. `updateProfile` (lines 58-79)
2. `updateNotificationPreferences` (lines 250-270)
3. `updatePricingMode` (lines 272-296)
4. `updateWarehouseLocation` (lines 298-324)
5. `updatePricingPreferences` (lines 326-356)
6. `updatePastDueSettings` (lines 358-409)
7. `updateClientRescheduleSettings` (lines 411-458)
8. `updateNotificationSettings` (lines 460-498)
9. `updateTimeSlots` (lines 501-541)
10. `updateWorkingDays` (lines 543-569)
11. `updateTimezone` (lines 571-596)

**Actions WITH proper role checks (for comparison):**
- `updateUrgencyFee`
- `createUrgencyFee`
- `toggleUrgencyFee`
- `deleteUrgencyFee`

## Proposed Solutions

### Option A: Add role checks to each action
**Pros:** Quick fix, explicit
**Cons:** Repetitive code (8 lines × 11 actions = 88 lines)
**Effort:** Medium
**Risk:** Low

### Option B: Extract requireCourier() helper (Recommended)
**Pros:** DRY, prevents future omissions, cleaner code
**Cons:** Larger refactor
**Effort:** Medium
**Risk:** Low

```typescript
async function requireCourier(locals) {
    const { session, user } = await locals.safeGetSession();
    if (!session || !user) return { error: 'Not authenticated' };
    const { data } = await locals.supabase.from('profiles').select('role').eq('id', user.id).single();
    if (data?.role !== 'courier') return { error: 'Unauthorized' };
    return { user };
}
```

## Recommended Action

Extract helper function and apply to all courier-only actions.

## Technical Details

**Affected Files:**
- `src/routes/courier/settings/+page.server.ts`

## Acceptance Criteria

- [ ] All 11 settings actions verify courier role
- [ ] Helper function extracted to reduce duplication
- [ ] Non-courier users receive 'Unauthorized' error

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during security review | Defense in depth requires server-side role checks |

## Resources

- OWASP A01: Broken Access Control
