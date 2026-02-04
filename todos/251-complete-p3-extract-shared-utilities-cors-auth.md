---
status: ready
priority: p3
issue_id: "251"
tags: [code-review, code-quality, dry, pr-13]
dependencies: []
---

# Extract Shared Utilities (CORS, Auth) to Shared Module

## Problem Statement

CORS configuration and service role key validation are duplicated across multiple edge functions. These should be extracted to shared modules.

## Findings

**Source:** architecture-strategist agent

**CORS duplication:**
- `supabase/functions/send-email/index.ts` lines 18-31
- `supabase/functions/send-notification/index.ts` lines 38-42
- `supabase/functions/send-push/index.ts` lines 21-25
- `supabase/functions/create-client/index.ts` lines 17-21
- `supabase/functions/reset-client-password/index.ts` lines 11-15

**Auth duplication:**
- `isServiceRoleKey()` function in both `send-notification` and `send-email`

**Impact:**
- Changes require updates in 5+ files
- Inconsistency risk
- Maintenance burden

## Proposed Solutions

### Solution 1: Create Shared Modules (Recommended)
**Pros:** DRY, single maintenance point
**Cons:** Slight refactoring effort
**Effort:** Medium
**Risk:** Low

```typescript
// supabase/functions/_shared/cors.ts
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://barecourier.vercel.app",
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// supabase/functions/_shared/auth.ts
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

export function isServiceRoleKey(authHeader: string, serviceKey: string): boolean {
  const bearerToken = authHeader.replace('Bearer ', '');
  if (bearerToken.length !== serviceKey.length) return false;
  return timingSafeEqual(Buffer.from(bearerToken), Buffer.from(serviceKey));
}
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**New Files to Create:**
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/auth.ts`

**Files to Update:**
- All edge functions using CORS or auth utilities

## Acceptance Criteria

- [ ] CORS logic in single file
- [ ] Auth utilities in single file
- [ ] All edge functions use shared modules
- [ ] No behavioral changes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Utility duplication across edge functions |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
