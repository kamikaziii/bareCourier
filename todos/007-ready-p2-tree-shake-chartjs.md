# Tree-Shake Chart.js Imports

---
status: ready
priority: p2
issue_id: "007"
tags: [code-review, performance, bundle-size]
dependencies: []
---

## Problem Statement

Chart.js is imported with `registerables` which loads the entire library (~60KB gzipped) for each chart type, even when only one type is used per component.

**Why it matters**: Mobile-first PWA should minimize bundle size for faster load times.

## Findings

- **Location**: `src/lib/components/charts/BarChart.svelte`, `LineChart.svelte`, `DoughnutChart.svelte`
- **Agent**: performance-oracle

**Current Code**:
```typescript
import { Chart, registerables, type ChartData, type ChartOptions } from 'chart.js';
Chart.register(...registerables);
```

**Estimated Waste**: ~180KB total (3 components x 60KB each, with redundant registrations)

## Proposed Solutions

### Option 1: Import Only Required Controllers (Recommended)
```typescript
// BarChart.svelte
import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);
```

**Pros**: ~30-40KB savings per component
**Cons**: Need to identify exact imports needed
**Effort**: Low
**Risk**: Low

### Option 2: Consolidate to Single Generic Chart Component
See issue #008 - this would also solve the tree-shaking issue.

## Acceptance Criteria

- [ ] Bundle size reduced by ~50KB+
- [ ] All 3 chart types still render correctly
- [ ] No console warnings about missing registrations

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by performance-oracle, code-simplicity-reviewer | registerables is convenient but wasteful |
| 2026-01-22 | Approved during triage | Ready for implementation - selective chart registration |
