---
status: complete
priority: p3
issue_id: "132"
tags: [code-review, quality, vat]
dependencies: []
---

# Magic Number 23 for Default VAT Rate

## Problem Statement
`PricingTab.svelte` uses `profile.vat_rate ?? 23` with no explanation of why 23. This is the Portuguese standard VAT rate but is not documented or extracted as a constant.

## Findings
- Source: Code Simplicity Reviewer
- Location: `src/routes/courier/settings/PricingTab.svelte`

## Proposed Solutions

### Option A: Extract named constant
- `const DEFAULT_VAT_RATE = 23; // Portuguese standard rate`
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] Magic number replaced with named constant
- [ ] Comment explains the value

## Work Log
| 2026-01-27 | Approved | Triage: verified and approved for work |
| Date | Action | Notes |
|------|--------|-------|
| 2026-01-27 | Created | From multi-agent code review of VAT implementation |
