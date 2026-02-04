---
status: ready
priority: p2
issue_id: "262"
tags: [code-review, performance, architecture, pr-16]
dependencies: []
---

# Client Dashboard Should Use Server-Side Loading

## Problem Statement

The client dashboard fetches ALL services client-side in an `$effect()`, then filters/sorts client-side. This pattern will degrade as service history grows.

**Why it matters:**
- At 100 services: ~2KB payload, minimal impact
- At 1,000 services: ~20KB payload, noticeable on mobile
- At 10,000 services: ~200KB payload, significant latency
- Client-side filtering re-processes entire array on every filter change

## Findings

**Location:** `src/routes/client/+page.svelte` (lines 55-65)

```typescript
async function loadServices() {
    loading = true;
    const { data: result } = await data.supabase
        .from("services")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

    services = (result || []) as Service[];
    loading = false;
}

$effect(() => {
    loadServices();
});
```

**Contrast with courier pattern:** `src/routes/courier/services/+page.server.ts` (lines 10-35):

```typescript
export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
    const [servicesResult, clientsResult] = await Promise.all([
        supabase
            .from('services')
            .select('*, profiles!client_id(id, name, default_pickup_location)')
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
        // ...
    ]);
    return { services: servicesResult.data || [] };
};
```

## Proposed Solutions

### Option A: Move to +page.server.ts (Recommended)
**Pros:** SSR, better SEO, consistent with courier pattern
**Cons:** Requires refactoring data flow
**Effort:** Medium
**Risk:** Low

### Option B: Add pagination with server-side filtering
**Pros:** Handles large datasets efficiently
**Cons:** More complex, requires API changes
**Effort:** Medium-High
**Risk:** Low

### Option C: Keep client-side but add query limits
**Pros:** Quick fix, minimal changes
**Cons:** Doesn't solve root issue, just delays it
**Effort:** Small
**Risk:** Low

## Recommended Action

Implement Option A to match the courier services pattern.

## Technical Details

- **Affected files:**
  - `src/routes/client/+page.svelte` (refactor to use `data.services`)
  - Create `src/routes/client/+page.server.ts` (new file)
- **Data flow change:** From `$effect() → loadServices()` to `load() → data.services`
- **Filter state:** Keep client-side for instant feedback, but data comes from server

## Acceptance Criteria

- [ ] Create `src/routes/client/+page.server.ts` with server-side load
- [ ] Refactor `+page.svelte` to use `data.services` from props
- [ ] Remove `loadServices()` function and `$effect()`
- [ ] Keep client-side filtering/sorting for instant UX
- [ ] Verify RLS still works correctly (client sees only their services)
- [ ] Test with pagination controls if large dataset

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from post-merge audit | Client-side loading doesn't scale |

## Resources

- PR #16: https://github.com/kamikaziii/bareCourier/pull/16
- SvelteKit Loading Data: https://kit.svelte.dev/docs/load
