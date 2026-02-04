---
status: ready
priority: p2
issue_id: "221"
tags: [code-review, performance, ux, pr-15]
dependencies: []
---

# P2: Client Status Check Creates Extra Network Round-Trip

## Problem Statement

Client confirmation status is fetched via a separate edge function call on every client detail page load, adding 100-300ms to perceived load time.

**Why it matters:** Every client detail page view incurs an extra API call that could be avoided.

## Findings

**Location:** `src/routes/courier/clients/[id]/+page.svelte:71-107`

```typescript
$effect(() => {
  checkClientStatus();  // Separate network call on every mount
});

async function checkClientStatus() {
  checkingStatus = true;
  const { data: sessionData } = await data.supabase.auth.getSession();
  const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/check-client-status`, {...});
  // ...
}
```

**Impact:** +100-300ms per page view

## Proposed Solutions

### Option A: Fetch in +page.server.ts (Recommended)
**Pros:** Status included in initial page data, no extra client call
**Cons:** Requires server-side edge function call or direct admin query
**Effort:** Medium
**Risk:** Low

```typescript
// +page.server.ts
import { createClient } from '@supabase/supabase-js';

export const load: PageServerLoad = async ({ locals, params }) => {
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: userStatus } = await adminClient.auth.admin.getUserById(params.id);

  return {
    ...existingData,
    clientStatus: {
      isConfirmed: !!userStatus?.email_confirmed_at,
      email: userStatus?.email
    }
  };
};
```

### Option B: Add `email_confirmed` column to profiles table
**Pros:** No extra query, syncs via trigger, fastest
**Cons:** Requires migration, trigger setup
**Effort:** Medium-Large
**Risk:** Medium (schema change)

### Option C: Cache client-side for session duration
**Pros:** Minimal change
**Cons:** Still requires first call, stale until refresh
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `src/routes/courier/clients/[id]/+page.svelte`
- `src/routes/courier/clients/[id]/+page.server.ts` (if Option A)
- `supabase/migrations/` (if Option B)

**Components affected:**
- Client detail page load performance

**Database changes:**
- Option B requires migration to add `email_confirmed` column

## Acceptance Criteria

- [ ] Client status available without extra API call
- [ ] Page load time improved by 100-300ms
- [ ] Resend invitation button still shows correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #15 review | Performance and Architecture agents flagged round-trip |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
