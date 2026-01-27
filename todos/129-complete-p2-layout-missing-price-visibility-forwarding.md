---
status: complete
priority: p2
issue_id: "129"
tags: [code-review, architecture, consistency]
dependencies: []
---

# Layout Missing show_price_to_* Forwarding

## Problem Statement
`src/routes/courier/+layout.server.ts` forwards VAT fields (`vat_enabled`, `vat_rate`, `prices_include_vat`) but does not forward `show_price_to_courier` or `show_price_to_client`. This creates an inconsistency where some pricing settings are available via layout data and others require separate queries.

## Findings
- Source: Pattern Recognition Specialist
- Location: `src/routes/courier/+layout.server.ts`

## Proposed Solutions

### Option A: Forward all pricing-related fields from layout (Recommended)
- Add `show_price_to_courier` and `show_price_to_client` to layout return
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] All pricing visibility settings available from layout data
- [ ] No separate queries needed for these fields in child routes

## Work Log
| 2026-01-27 | Approved | Triage: verified and approved for work |
| Date | Action | Notes |
|------|--------|-------|
| 2026-01-27 | Created | From multi-agent code review of VAT implementation |
