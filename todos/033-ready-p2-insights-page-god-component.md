# Insights Page is a God Component

---
status: ready
priority: p2
issue_id: "033"
tags: [architecture, refactor, code-quality]
dependencies: []
---

**Priority**: P2 (Important)
**File**: `src/routes/courier/insights/+page.svelte` (600+ lines)
**Source**: architecture-strategist code review

## Issue

The insights page violates Single Responsibility Principle by mixing:
- Analytics data loading
- Chart rendering
- Data filtering
- CSV export logic
- Multiple tab management

## Fix

Extract into dedicated components:
1. `OverviewTab.svelte` - Summary metrics
2. `ChartsTab.svelte` - Visualization components
3. `DataTab.svelte` - Table/export functionality
4. `ChartDataProvider.ts` - Data fetching/transformation service

## Benefit

- Easier to test individual features
- Better code navigation
- Reduced cognitive load
- Reusable chart components

## Acceptance Criteria

- [ ] Page split into 3+ smaller components
- [ ] Each component under 200 lines
- [ ] All tabs still function correctly
- [ ] No regression in functionality

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by architecture-strategist agent | 600+ line components need decomposition |
| 2026-01-24 | Approved during triage | Status changed to ready |
