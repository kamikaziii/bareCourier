---
status: pending
priority: p2
issue_id: "218"
tags: [code-review, architecture, code-quality, pr-15]
dependencies: []
---

# P2: CORS Handler Duplication Across Edge Functions

## Problem Statement

The `getCorsHeaders()` function is duplicated across 4+ edge functions with subtle variations. This creates maintenance burden and inconsistent behavior.

**Why it matters:**
- Bug fixes must be applied in 4+ places
- Different functions have different allowed origins (send-email is stricter)
- Preview deployments work for some functions but not others

## Findings

**Locations:**
- `supabase/functions/create-client/index.ts:13-27` - Dynamic pattern
- `supabase/functions/check-client-status/index.ts:11-25` - Dynamic pattern
- `supabase/functions/reset-client-password/index.ts` - Dynamic pattern
- `supabase/functions/send-email/index.ts:18-31` - **Static allowlist** (different!)

**Pattern A (dynamic - 3 functions):**
```typescript
const isAllowed =
  origin.startsWith("http://localhost:") ||
  origin === "https://barecourier.vercel.app" ||
  (origin.endsWith(".vercel.app") && origin.includes("barecourier"));
```

**Pattern B (static - send-email):**
```typescript
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://barecourier.vercel.app",
];
```

**Impact:** Preview deployments (e.g., `barecourier-xyz.vercel.app`) work for client creation but fail for email sending.

## Proposed Solutions

### Option A: Extract to shared module (Recommended)
**Pros:** Single source of truth, consistent behavior
**Cons:** Requires imports in all functions
**Effort:** Medium (~30 min)
**Risk:** Low

```typescript
// supabase/functions/_shared/cors.ts
export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const isAllowed =
    origin.startsWith("http://localhost:") ||
    origin === "https://barecourier.vercel.app" ||
    (origin.endsWith(".vercel.app") && origin.includes("barecourier"));

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://barecourier.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}
```

### Option B: Document intentional differences
**Pros:** No code changes
**Cons:** Doesn't fix the consistency issue
**Effort:** Small
**Risk:** None (but doesn't address root cause)

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `supabase/functions/_shared/cors.ts` (new)
- `supabase/functions/create-client/index.ts`
- `supabase/functions/check-client-status/index.ts`
- `supabase/functions/reset-client-password/index.ts`
- `supabase/functions/send-email/index.ts`
- All other edge functions (for consistency)

**Components affected:**
- All edge function CORS handling

**Database changes:** None

## Acceptance Criteria

- [ ] CORS handling extracted to `_shared/cors.ts`
- [ ] All edge functions import from shared module
- [ ] Preview deployments work consistently across all functions
- [ ] No CORS errors in production

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #15 review | Architecture, Security, Pattern agents all flagged this |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
