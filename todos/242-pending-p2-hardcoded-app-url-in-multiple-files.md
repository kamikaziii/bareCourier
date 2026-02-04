---
status: pending
priority: p2
issue_id: "242"
tags: [code-review, architecture, maintainability, pr-13]
dependencies: []
---

# Hardcoded APP_URL in 10+ Files

## Problem Statement

The constant `APP_URL = 'https://barecourier.vercel.app'` is hardcoded in 10+ different files across the codebase. This violates DRY principles and makes deploying to different environments (staging, custom domains) difficult.

## Findings

**Source:** architecture-strategist agent, code-simplicity-reviewer agent

**Locations:**
- `src/routes/client/+page.server.ts` line 5
- `src/routes/client/new/+page.server.ts` line 18
- `src/routes/courier/+page.server.ts` line 7
- `src/routes/courier/requests/+page.server.ts` line 14
- `src/routes/courier/services/+page.server.ts` line 8
- `src/routes/courier/services/[id]/+page.server.ts` line 8
- `supabase/functions/daily-summary/index.ts` line 193
- `supabase/functions/check-past-due/index.ts` line 268

**Impact:**
- Every new deployment environment requires code changes
- Risk of forgetting to update some files
- Testing with different URLs requires code modification

## Proposed Solutions

### Solution 1: Environment Variable (Recommended)
**Pros:** Standard approach, works in all environments
**Cons:** Requires env setup in deployment
**Effort:** Medium
**Risk:** Low

**SvelteKit routes:**
```typescript
import { PUBLIC_APP_URL } from '$env/static/public';
const APP_URL = PUBLIC_APP_URL || 'https://barecourier.vercel.app';
```

**Edge functions:**
```typescript
const APP_URL = Deno.env.get('APP_URL') || 'https://barecourier.vercel.app';
```

### Solution 2: Shared Constants File
**Pros:** Single source of truth
**Cons:** Still requires env var for proper flexibility
**Effort:** Small
**Risk:** Low

```typescript
// src/lib/constants/app.ts
export const APP_URL = import.meta.env.VITE_APP_URL || 'https://barecourier.vercel.app';
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- 6 SvelteKit route files
- 2+ Edge function files

**Environment Variables to Add:**
- `PUBLIC_APP_URL` (SvelteKit)
- `APP_URL` (Edge functions - may already exist)

## Acceptance Criteria

- [ ] Single source of truth for APP_URL
- [ ] Can deploy to different domains without code changes
- [ ] Edge functions use environment variable with fallback
- [ ] SvelteKit routes use public env variable

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | DRY violation across 10+ files |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- SvelteKit env vars: https://kit.svelte.dev/docs/modules#$env-static-public
