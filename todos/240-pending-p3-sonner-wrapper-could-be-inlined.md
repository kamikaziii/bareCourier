---
status: pending
priority: p3
issue_id: "240"
tags: [code-review, simplicity, pr-16]
dependencies: []
---

# Sonner Component Wrapper Could Be Inlined

## Problem Statement

The Sonner wrapper component adds no significant functionality - it just re-exports Sonner with hardcoded icons. This indirection could be eliminated.

**Why it matters:** Unnecessary abstraction increases cognitive load.

## Findings

**Source:** Code Simplicity Agent

**Location:** `src/lib/components/ui/sonner/sonner.svelte`

**What it does:**
- Imports Sonner from svelte-sonner
- Sets up icon snippets (CircleCheckIcon, OctagonXIcon, etc.)
- Re-exports with spread props

**Usage:** Only in `src/routes/+layout.svelte`

## Proposed Solutions

### Option A: Keep As-Is (Recommended)
The wrapper follows shadcn-svelte conventions for component customization.

**Pros:** Consistent with other shadcn components, easy to modify icons later
**Cons:** Slight indirection
**Effort:** None
**Risk:** None

### Option B: Inline to Layout
Move icon setup directly to +layout.svelte.

**Pros:** One less component file
**Cons:** Breaks shadcn conventions, harder to customize later
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- Fill after triage - likely "Keep As-Is" -->

## Technical Details

**Affected files:**
- `src/lib/components/ui/sonner/sonner.svelte`
- `src/lib/components/ui/sonner/index.ts`
- `src/routes/+layout.svelte`

## Acceptance Criteria

- [ ] Decision made: keep wrapper OR inline
- [ ] If inlined, remove sonner/ directory

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #16 code review | Simplicity agent suggested inlining, but shadcn conventions favor wrapper |

## Resources

- PR #16: feat: implement toast notification system
- shadcn-svelte component conventions
