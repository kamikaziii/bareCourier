# Consolidate Chart Components into Single Generic Component

---
status: ready
priority: p3
issue_id: "008"
tags: [code-review, simplicity, code-duplication]
dependencies: ["007"]
---

## Problem Statement

Three nearly identical chart components (BarChart, LineChart, DoughnutChart) differ only in the chart type string. This is ~100 lines of duplicated code.

**Why it matters**: Maintenance burden - any change needs to be applied to all three files.

## Findings

- **Location**: `src/lib/components/charts/`
- **Agent**: code-simplicity-reviewer

**Current State**: 3 files, ~49 lines each, ~100 lines total

## Proposed Solutions

### Option 1: Single Generic Chart Component (Recommended)
```svelte
<script lang="ts">
  import { Chart, registerables, type ChartData, type ChartOptions, type ChartType } from 'chart.js';
  Chart.register(...registerables);

  let {
    type,
    data,
    options = {},
    height = '300px'
  }: {
    type: ChartType;
    data: ChartData;
    options?: ChartOptions;
    height?: string;
  } = $props();

  let canvas: HTMLCanvasElement | null = $state(null);
  let chart: Chart | null = $state(null);

  $effect(() => {
    if (!canvas) return;
    chart = new Chart(canvas, {
      type,
      data,
      options: { responsive: true, maintainAspectRatio: false, ...options }
    });
    return () => chart?.destroy();
  });

  $effect(() => {
    if (chart && data) {
      chart.data = data;
      chart.update();
    }
  });
</script>

<div style="height: {height}">
  <canvas bind:this={canvas}></canvas>
</div>
```

**Usage**:
```svelte
<Chart type="bar" {data} {options} />
<Chart type="line" {data} {options} />
<Chart type="doughnut" {data} {options} />
```

**Pros**: ~70 LOC saved, single maintenance point
**Cons**: Slightly less type-safe (ChartData vs BarChartData)
**Effort**: Low
**Risk**: Low

## Acceptance Criteria

- [ ] Single Chart.svelte component created
- [ ] Old components removed
- [ ] Analytics page updated to use new component
- [ ] All charts render correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by code-simplicity-reviewer | Premature abstraction created maintenance burden |
| 2026-01-22 | Approved during triage | Ready for implementation - depends on #007 completion |
