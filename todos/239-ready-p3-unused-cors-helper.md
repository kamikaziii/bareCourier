---
status: ready
priority: p3
issue_id: "239"
tags: [code-review, pr-15, dead-code, edge-functions]
dependencies: []
---

# Unused handleCorsPreFlight Helper

## Problem Statement

The `handleCorsPreFlight` helper function is defined in the shared CORS module but is never used by any edge function. This is dead code that adds maintenance overhead and cognitive load when reading the codebase.

## Findings

**Location:** `supabase/functions/_shared/cors.ts:33-38`

```typescript
export function handleCorsPreFlight(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
```

The edge functions in the codebase handle CORS preflight requests directly using `corsHeaders` rather than calling this helper function. Either:
1. The helper was added for future use but never adopted
2. The helper was refactored out but the definition was left behind

## Proposed Solution

**Option A (Remove):** Delete the unused function if no edge functions need it.

```diff
- export function handleCorsPreFlight(): Response {
-   return new Response(null, {
-     status: 204,
-     headers: corsHeaders
-   });
- }
```

**Option B (Use it):** Update edge functions to use the helper for consistency:

```typescript
// In edge function handlers
if (req.method === 'OPTIONS') {
  return handleCorsPreFlight();
}
```

## Acceptance Criteria

- [ ] Either the function is removed, or it is used by at least one edge function
- [ ] No dead code in the shared module
- [ ] If removed, verify no imports reference it

## Work Log

| Date | Action | Details |
|------|--------|---------|
| 2026-02-04 | Created | PR #15 code review finding |
