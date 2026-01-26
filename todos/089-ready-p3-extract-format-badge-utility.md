---
status: ready
priority: p3
issue_id: "089"
tags: [frontend, dry]
dependencies: []
---

# formatBadge Duplicated in 3 Components

## Problem Statement
formatBadge function defined in MobileBottomNav, MoreDrawer, and SidebarItem.

## Findings
- Location: Multiple files
  - src/lib/components/MobileBottomNav.svelte:22
  - src/lib/components/MoreDrawer.svelte:22
  - src/lib/components/SidebarItem.svelte:17
- Same logic duplicated three times

## Proposed Solutions

### Option 1: Extract to $lib/utils.js
- **Pros**: DRY, single source of truth
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Extract formatBadge to $lib/utils.ts and import in all three components

## Technical Details
- **Affected Files**: src/lib/utils.ts, 3 component files
- **Database Changes**: No

## Acceptance Criteria
- [ ] formatBadge in $lib/utils.ts
- [ ] All 3 components import from utils

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (frontend warning)
