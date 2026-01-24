# TypeScript `any` Types Need Proper Typing

---
status: ready
priority: p2
issue_id: "035"
tags: [typescript, type-safety, code-quality]
dependencies: []
---

**Priority**: P2 (Important)
**Files**:
- `src/routes/courier/+page.svelte:17,53,58` - `any[]` and `any` params
- `src/routes/courier/+layout.svelte:22` - `children: any`
- `src/routes/courier/clients/+page.svelte:154` - `client: any`
- `src/routes/+layout.svelte:13` - `children: any`
- `src/routes/client/+layout.svelte:13` - `children: any`
**Source**: kieran-typescript-reviewer

## Issue

Multiple files use `any` type instead of proper types, losing type safety:
- Services should be `Service[]`
- Update params should be `Partial<Service>`
- Children should be `Snippet` (Svelte 5)
- Client should be `Profile`

## Fix

1. Import proper types:
```typescript
import type { Service, Profile } from '$lib/database.types';
import type { Snippet } from 'svelte';
```

2. Update declarations:
```typescript
let services = $state<Service[]>([]);
let { children }: { children: Snippet } = $props();
```

## Verification

Run `pnpm run check` - should pass with no implicit any warnings.

## Acceptance Criteria

- [ ] No `any` types in layout files
- [ ] Services typed as `Service[]`
- [ ] Children typed as `Snippet`
- [ ] `pnpm run check` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by kieran-typescript-reviewer | Svelte 5 uses Snippet type for children |
| 2026-01-24 | Approved during triage | Status changed to ready |
