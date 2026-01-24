# Duplicated Navigation Code

---
status: ready
priority: p2
issue_id: "034"
tags: [code-quality, dry, refactor]
dependencies: []
---

**Priority**: P2 (Important)
**Files**:
- `src/lib/components/MobileBottomNav.svelte`
- `src/lib/components/MoreDrawer.svelte`
- `src/lib/components/Sidebar.svelte`
**Source**: architecture-strategist, pattern-recognition-specialist

## Issue

1. `isItemActive()` function duplicated verbatim in 3 files
2. `NavItem` interface defined identically in 3 files
3. Inline SVG for "More" icon while others use lucide-svelte

## Fix

1. Create `src/lib/types/navigation.ts`:
```typescript
export interface NavItem {
  href: string;
  label: string;
  icon: typeof Icon;
  badge?: number;
}

export function isItemActive(item: NavItem, pathname: string): boolean {
  // shared logic
}
```

2. Replace inline SVG with `MoreHorizontal` from `@lucide/svelte`

## Verification

Grep for `isItemActive` - should only exist in one location after fix.

## Acceptance Criteria

- [ ] NavItem interface defined once
- [ ] isItemActive function defined once
- [ ] All components import from shared location
- [ ] Inline SVG replaced with lucide icon

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by 2 agents | DRY principle violated in nav components |
| 2026-01-24 | Approved during triage | Status changed to ready |
