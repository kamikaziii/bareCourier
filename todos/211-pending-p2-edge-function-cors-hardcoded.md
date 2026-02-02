---
status: pending
priority: p2
issue_id: "211"
tags: [security, infrastructure, code-review]
dependencies: []
---

# Fix Hardcoded CORS Origins in Reset Password Edge Function

## Problem Statement

The reset-client-password edge function has hardcoded CORS origins, which means:
1. Vercel preview deployments (e.g., `barecourier-git-feature-x.vercel.app`) will fail CORS
2. Any staging environment would need manual code changes
3. New production domains require code deployment

**Impact:** Development and QA workflows are impacted; preview deployments can't test password reset functionality.

## Findings

- **File:** `supabase/functions/reset-client-password/index.ts` (lines 8-12)
- **Current behavior:**
  - Only 3 hardcoded origins allowed
  - Preview deployments get CORS errors
  - No environment-based configuration

**Code evidence:**
```typescript
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://barecourier.vercel.app",
];
```

## Proposed Solutions

### Option 1: Pattern Matching for Vercel (Recommended)

**Approach:** Use pattern matching to allow all Vercel preview deployments while keeping security for production.

**Pros:**
- Supports all preview deployments automatically
- No environment variables needed
- Still secure (only allows known domains)

**Cons:**
- Slightly more permissive than explicit list

**Effort:** 15 minutes

**Risk:** Low

**Implementation:**
```typescript
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";

  const isAllowed =
    origin.startsWith("http://localhost:") ||
    origin === "https://barecourier.vercel.app" ||
    (origin.endsWith(".vercel.app") && origin.includes("barecourier"));

  const allowedOrigin = isAllowed ? origin : "https://barecourier.vercel.app";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}
```

---

### Option 2: Environment Variable Configuration

**Approach:** Use Supabase secrets/environment variables to configure allowed origins.

**Pros:**
- Most flexible
- No code changes for new environments

**Cons:**
- Requires Supabase Dashboard configuration
- Harder to manage lists

**Effort:** 30 minutes

**Risk:** Low

---

### Option 3: Apply to All Edge Functions

**Approach:** Same pattern matching, but also update create-client and other edge functions for consistency.

**Pros:**
- Consistent CORS handling across all functions
- One-time fix

**Cons:**
- More files to change

**Effort:** 45 minutes

**Risk:** Low

## Recommended Action

_To be filled during triage._

## Technical Details

**Affected files:**
- `supabase/functions/reset-client-password/index.ts:8-12`
- `supabase/functions/create-client/index.ts` (same pattern exists)
- Other edge functions with CORS

**Related components:**
- Vercel preview deployments
- Supabase Edge Functions

## Resources

- **Vercel Docs:** Preview deployment URLs
- **Related:** Same issue exists in create-client function

## Acceptance Criteria

- [ ] Vercel preview deployments can call edge functions
- [ ] localhost development still works
- [ ] Production domain still works
- [ ] Arbitrary external domains still blocked
- [ ] Test: Preview deployment → password reset works
- [ ] Test: External domain → CORS error

## Work Log

### 2026-02-02 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Identified hardcoded CORS origins in edge function
- Noted same pattern exists in create-client function
- Proposed pattern-matching approach for Vercel URLs

**Learnings:**
- Vercel preview URLs follow pattern: `{project}-{hash}-{scope}.vercel.app`
- Pattern matching is more maintainable than explicit lists

## Notes

- Check other edge functions for same issue
- Consider creating shared CORS utility for edge functions
