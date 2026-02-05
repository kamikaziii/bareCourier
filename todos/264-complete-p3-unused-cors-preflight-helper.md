---
status: complete
priority: p3
issue_id: "264"
tags: [code-review, cleanup, architecture]
dependencies: []
---

# Unused handleCorsPreflightRequest Helper

## Problem Statement

The `handleCorsPreflightRequest()` function is exported from `_shared/cors.ts` but never used. All edge functions manually inline the CORS preflight logic.

**Why it matters:**
- Dead code in shared utilities
- Inconsistency: helper exists but isn't used
- Minor cognitive overhead when reading codebase

## Findings

**Location:** `supabase/functions/_shared/cors.ts` (lines 84-86)

```typescript
export function handleCorsPreflightRequest(req: Request): Response {
    return new Response("ok", { headers: getCorsHeaders(req) });
}
```

**Usage search:** Only referenced in `cors.ts` itself - no imports found.

**All edge functions do this instead:**

```typescript
if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
}
```

## Proposed Solutions

### Option A: Remove the unused function (Recommended)
**Pros:** Cleaner codebase, no dead code
**Cons:** None
**Effort:** Small
**Risk:** Very Low

### Option B: Use the helper in all edge functions
**Pros:** Consistent, DRY
**Cons:** More changes, marginal benefit
**Effort:** Medium
**Risk:** Very Low

### Option C: Keep but mark as @deprecated
**Pros:** No changes needed
**Cons:** Still dead code
**Effort:** None
**Risk:** N/A

## Recommended Action

Implement Option A. Remove the unused function.

## Technical Details

- **Affected file:** `supabase/functions/_shared/cors.ts`
- **Lines to remove:** 81-86 (comment + function)
- **Verification:** Search codebase for `handleCorsPreflightRequest` to confirm no usage

## Acceptance Criteria

- [ ] `handleCorsPreflightRequest` function removed from `_shared/cors.ts`
- [ ] No TypeScript errors after removal
- [ ] All edge functions still handle OPTIONS requests correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from post-merge audit | Remove unused code promptly |

## Resources

- Supabase shared modules: https://supabase.com/docs/guides/functions/quickstart#shared-modules
