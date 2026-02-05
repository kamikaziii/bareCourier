---
status: complete
priority: p2
issue_id: "260"
tags: [code-review, security, architecture, pr-13]
dependencies: []
---

# CORS Inconsistency in Cron Functions

## Problem Statement

The `check-past-due` and `daily-summary` edge functions use hardcoded wildcard CORS (`*`) instead of the secure `getCorsHeaders()` utility used by other functions. While these are cron-triggered functions that don't need CORS, the inconsistency could lead to security issues if the pattern is copied elsewhere.

**Why it matters:**
- Inconsistent security posture across codebase
- Wildcard CORS could be accidentally copied to user-facing functions
- Code duplication (same hardcoded headers in multiple files)

## Findings

**check-past-due/index.ts (lines 104-107):**
```typescript
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
```

**daily-summary/index.ts (lines 31-34):**
```typescript
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
```

**Contrast with secure pattern (other functions):**
```typescript
import { getCorsHeaders } from "../_shared/cors.ts";
const corsHeaders = getCorsHeaders(req);
```

## Proposed Solutions

### Option A: Remove CORS headers entirely (Recommended)
**Pros:** Clearest intent - cron functions don't need CORS
**Cons:** Slight refactor needed for error responses
**Effort:** Small
**Risk:** Very Low

Since these functions are called by Supabase's pg_cron scheduler (server-to-server), they never receive browser requests. CORS is irrelevant.

### Option B: Use getCorsHeaders for consistency
**Pros:** All functions use same pattern
**Cons:** Unnecessary overhead for cron functions
**Effort:** Small
**Risk:** Very Low

### Option C: Create getInternalCorsHeaders helper
**Pros:** Documents that these are internal endpoints
**Cons:** Adds abstraction for little benefit
**Effort:** Small
**Risk:** Very Low

## Recommended Action

Implement Option A. Remove CORS headers from cron functions since they're never called from browsers.

## Technical Details

- **Affected files:**
  - `supabase/functions/check-past-due/index.ts`
  - `supabase/functions/daily-summary/index.ts`
- **Lines to modify:** CORS header definitions and their usage in responses
- **Deployment:** `supabase functions deploy check-past-due daily-summary`

## Acceptance Criteria

- [ ] `check-past-due` no longer includes CORS headers (or uses shared utility)
- [ ] `daily-summary` no longer includes CORS headers (or uses shared utility)
- [ ] Functions still work correctly when triggered by cron
- [ ] Add comment explaining why CORS is omitted (for future maintainers)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from post-merge audit | Cron functions don't need browser CORS |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
- MDN CORS: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
