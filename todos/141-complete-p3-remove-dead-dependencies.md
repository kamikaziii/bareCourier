---
status: complete
priority: p3
issue_id: "141"
tags: [architecture, dependencies, cleanup]
dependencies: []
---

# Remove Unused Dependencies (lucide-svelte, adapter-auto)

## Problem Statement
Two packages in package.json are unused:
- `lucide-svelte` (dependencies) — zero imports in codebase, all icons use `@lucide/svelte`
- `@sveltejs/adapter-auto` (devDependencies) — svelte.config.js uses adapter-vercel

## Findings
- Source: Architecture Strategist (full review 2026-01-27)
- Location: `package.json:48` (lucide-svelte), `package.json:18` (adapter-auto)
- Verified: `grep -r "lucide-svelte" src/` returns 0 matches

## Proposed Solutions

### Option 1: Remove both packages
- `pnpm remove lucide-svelte @sveltejs/adapter-auto`
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Acceptance Criteria
- [ ] `lucide-svelte` removed from dependencies
- [ ] `@sveltejs/adapter-auto` removed from devDependencies
- [ ] Build succeeds after removal
