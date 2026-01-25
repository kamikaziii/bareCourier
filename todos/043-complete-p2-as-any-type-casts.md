# Type Casting (as any) Overuse in PR #4

---
status: complete
priority: p2
issue_id: "043"
tags: [typescript, type-safety, pr-4]
dependencies: []
---

**Priority**: P2 (Important)
**Files**:
- `src/routes/client/new/+page.server.ts:92`
- `src/routes/courier/services/+page.server.ts:75`
- `src/routes/courier/billing/[client_id]/+page.server.ts:155`
- `src/routes/courier/services/[id]/+page.server.ts:131`
**Source**: PR #4 Code Review

## Issue

Multiple files use `(supabase as any)` to bypass TypeScript type checking. This suggests the database types in `database.types.ts` are out of sync with the actual schema.

## Current Code

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { error: insertError } = await (supabase as any).from('services').insert({
  // ...
});
```

## Root Cause

The `database.types.ts` file likely doesn't include the new columns:
- `price_override_reason` on services
- `show_price_to_courier` on profiles
- `show_price_to_client` on profiles

## Fix

1. Regenerate types: `pnpm supabase gen types typescript --local > src/lib/database.types.ts`
2. Or manually update `database.types.ts` with missing columns
3. Remove all `as any` casts

## Acceptance Criteria

- [ ] No `as any` casts for Supabase client
- [ ] `database.types.ts` includes all new columns
- [ ] `pnpm run check` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified in PR #4 review | Types should stay in sync with migrations |
| 2026-01-24 | Approved during triage | Status: ready |
