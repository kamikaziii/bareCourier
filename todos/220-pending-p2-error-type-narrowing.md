---
status: pending
priority: p2
issue_id: "220"
tags: [code-review, typescript, error-handling, pr-15]
dependencies: []
---

# P2: Missing Error Type Narrowing in Catch Blocks

## Problem Statement

All edge functions have catch blocks that access `error.message` without type narrowing. TypeScript strict mode flags this, and if a non-Error object is thrown, `error.message` returns `undefined`.

**Why it matters:** Could cause confusing error messages in production if non-Error objects are thrown.

## Findings

**Locations:** All edge functions in the PR

```typescript
// create-client/index.ts:319-323
} catch (error) {
  return new Response(
    JSON.stringify({ error: error.message }),  // TypeScript: error is 'unknown'
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

**Impact:** If `error` is not an Error instance (e.g., a string was thrown), `error.message` is `undefined`, resulting in `{"error":undefined}` or `{"error":"undefined"}`.

## Proposed Solutions

### Option A: Add proper type narrowing (Recommended)
**Pros:** TypeScript-safe, handles all thrown types
**Cons:** Minor verbosity
**Effort:** Small (~5 min per function)
**Risk:** Very Low

```typescript
} catch (error) {
  const message = error instanceof Error ? error.message : 'An unknown error occurred';
  return new Response(
    JSON.stringify({ error: message }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### Option B: Cast to Error (Less safe)
**Pros:** Minimal change
**Cons:** Assumes all thrown values are Errors
**Effort:** Tiny
**Risk:** Low (but not type-safe)

```typescript
} catch (error) {
  return new Response(
    JSON.stringify({ error: (error as Error).message }),
    ...
  );
}
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `supabase/functions/create-client/index.ts`
- `supabase/functions/check-client-status/index.ts`
- `supabase/functions/send-email/index.ts`
- All other edge functions (for consistency)

**Components affected:**
- Error responses in all edge functions

**Database changes:** None

## Acceptance Criteria

- [ ] All catch blocks use proper type narrowing
- [ ] No TypeScript warnings in strict mode
- [ ] Error responses always have meaningful messages

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #15 review | Architecture agent flagged TypeScript issue |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
- TypeScript Error Handling: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
