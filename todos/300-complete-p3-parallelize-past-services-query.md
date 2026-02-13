---
status: complete
priority: p3
issue_id: "300"
tags: [code-review, performance, supabase, pr-19]
dependencies: []
---

# Parallelize past-services query with courier profile query

## Problem Statement

The new past-services Supabase query runs sequentially after the courier profile query, but is completely independent of it. Running them in parallel via `Promise.all` would save ~30-80ms per page load.

## Findings

- Current sequential chain in `src/routes/client/new/+page.ts`:
  1. `await courierProfile` (~30-80ms)
  2. conditionally `await clientProfile` (~30-80ms)
  3. conditionally `await serviceType` (~30-80ms)
  4. `await pastServices` (NEW, ~30-80ms)
- Query 4 only depends on `profile.id` from `parent()`, not on queries 1-3
- Performance oracle estimated 25-33% reduction in total loader time
- Found by: performance-oracle agent

## Proposed Solutions

### Option 1: Promise.all for independent queries

**Approach:** Run courierProfile and pastServices in parallel:

```typescript
const [courierProfileResult, pastServicesResult] = await Promise.all([
  supabase.from('profiles').select('...').eq('role', 'courier').limit(1).single(),
  profile?.id
    ? supabase.from('services').select('...').eq('client_id', profile.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(50)
    : Promise.resolve({ data: null })
]);
```

**Pros:** Saves one full round-trip (~30-80ms), no behavioral change
**Cons:** Slightly more complex control flow
**Effort:** 15 minutes
**Risk:** Low

## Recommended Action

## Technical Details

**Affected files:**
- `src/routes/client/new/+page.ts` — restructure query execution order

## Resources

- **PR:** #19

## Acceptance Criteria

- [ ] Past-services query runs in parallel with courier profile query
- [ ] No behavioral change to the page
- [ ] `pnpm run check` passes

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Claude Code (PR #19 review)

**Actions:**
- Performance oracle identified sequential query waterfall
- Verified query independence (only needs profile.id from parent)
