---
status: complete
priority: p1
issue_id: "124"
tags: [code-review, security, data-integrity, vat]
dependencies: []
---

# VAT Form Stale State Overwrite Risk

## Problem Statement
The VAT card in `PricingTab.svelte:231` submits to the same `?/updatePricingPreferences` action used by the pricing preferences form. It carries 5 hidden inputs with unrelated pricing state (`pricing_mode`, `round_distance`, etc.). In a multi-tab scenario, Tab B submitting the VAT form silently overwrites Tab A's unsaved pricing changes. Every other settings card uses its own dedicated action.

## Findings
- Source: Data Integrity Guardian, Pattern Recognition, Code Simplicity, Architecture Strategist
- Location: `src/routes/courier/settings/PricingTab.svelte:231`
- Server action: `src/routes/courier/settings/+page.server.ts` → `updatePricingPreferences`
- Every other card (profile, notifications, etc.) has a dedicated action

## Proposed Solutions

### Option A: Create dedicated `?/updateVatSettings` action (Recommended)
- **Pros**: Follows existing pattern, eliminates stale state risk, clean separation
- **Cons**: Adds one more action handler (~20 LOC)
- **Effort**: Small
- **Risk**: Low

### Option B: Merge VAT fields into existing pricing form as one section
- **Pros**: Single form, single submit
- **Cons**: Larger form, couples VAT with pricing mode changes
- **Effort**: Medium
- **Risk**: Low

## Acceptance Criteria
- [ ] VAT settings submit via dedicated action
- [ ] No hidden inputs carrying unrelated state
- [ ] Existing pricing preferences action unchanged
- [ ] VAT toggle/rate/includes-vat all save correctly

## Work Log
| 2026-01-27 | Approved | Triage: verified and approved for work |
| Date | Action | Notes |
|------|--------|-------|
| 2026-01-27 | Created | From multi-agent code review of VAT implementation |
