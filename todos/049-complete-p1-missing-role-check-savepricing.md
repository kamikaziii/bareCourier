---
status: ready
priority: p1
issue_id: "049"
tags: [code-review, security, authorization]
dependencies: []
---

# Missing Role Check in savePricing Action

## Problem Statement

The `savePricing` action in `/src/routes/courier/clients/[id]/+page.server.ts` is missing a courier role check. While it verifies authentication, it doesn't verify the user is a courier before allowing them to modify pricing configurations.

A malicious client could potentially modify pricing configurations for any client by directly crafting a POST request to this endpoint.

## Findings

**Location:** `src/routes/courier/clients/[id]/+page.server.ts` lines 108-151

**Evidence:**
```typescript
savePricing: async ({ params, request, locals: { supabase, safeGetSession } }) => {
    const { session, user } = await safeGetSession();
    if (!session || !user) {
        return { success: false, error: 'Not authenticated' };
    }
    // NO COURIER ROLE CHECK HERE - directly proceeds to modify pricing
```

Compare with `toggleActive` action (lines 76-106) which correctly includes:
```typescript
const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null };

if (profile?.role !== 'courier') {
    return { success: false, error: 'Unauthorized' };
}
```

## Proposed Solutions

### Option A: Add role check (Recommended)
**Pros:** Consistent with other actions, secure
**Cons:** None
**Effort:** Small
**Risk:** Very Low

Add the same role verification pattern used in `toggleActive`.

### Option B: Extract helper function
**Pros:** DRY, prevents future omissions
**Cons:** Larger change
**Effort:** Medium
**Risk:** Low

Create a `requireCourier()` helper function.

## Recommended Action

Add role check to `savePricing` action immediately, consider helper extraction later.

## Technical Details

**Affected Files:**
- `src/routes/courier/clients/[id]/+page.server.ts`

**Code to add after line 112:**
```typescript
// Verify courier role
const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as { data: { role: string } | null };

if (profile?.role !== 'courier') {
    return { success: false, error: 'Unauthorized' };
}
```

## Acceptance Criteria

- [ ] `savePricing` action verifies user has courier role
- [ ] Non-courier users receive 'Unauthorized' error
- [ ] Existing functionality unchanged for couriers

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during security review | Layout guards don't protect against direct POST requests |

## Resources

- OWASP A01: Broken Access Control
