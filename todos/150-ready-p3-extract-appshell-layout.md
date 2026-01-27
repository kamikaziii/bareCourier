---
status: ready
priority: p3
issue_id: "150"
tags: [frontend, code-duplication, architecture]
dependencies: []
---

# Extract Shared AppShell Layout Component

## Problem Statement
courier/+layout.svelte and client/+layout.svelte share ~80% identical markup: sticky header with language switcher, NotificationBell, profile name, logout button, Sidebar, MobileBottomNav, and main content wrapper. Only nav items and a few conditional details differ.

## Findings
- Source: Architecture Strategist (full review 2026-01-27)
- Locations:
  - `src/routes/courier/+layout.svelte`
  - `src/routes/client/+layout.svelte`

## Proposed Solutions

### Option 1: Create AppShell.svelte
- Props: navItems, profile, role, navCounts, children
- Contains header, sidebar, mobile nav, main wrapper
- Both role layouts become thin wrappers passing config
- **Effort**: Medium (1-2 hours)
- **Risk**: Low-Medium (touches layout structure)

## Acceptance Criteria
- [ ] `$lib/components/AppShell.svelte` created
- [ ] Both role layouts use AppShell
- [ ] Layout visually unchanged
- [ ] No duplicated header/sidebar/nav markup
