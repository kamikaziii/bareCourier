---
status: complete
priority: p2
issue_id: "128"
tags: [code-review, quality, duplication]
dependencies: []
---

# Duplicated Summary Cards in Billing Page

## Problem Statement
The billing page duplicates the first 2 summary cards (Services count, Total Distance) between VAT and non-VAT blocks. These cards are identical regardless of VAT status.

## Findings
- Source: Code Simplicity Reviewer
- Location: `src/routes/courier/billing/[client_id]/+page.svelte`

## Proposed Solutions

### Option A: Render shared cards once, conditional VAT cards after (Recommended)
- Always render Services + Distance cards
- Conditionally render VAT-specific cards (Net, VAT, Gross) or simple Total card
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] Services and Distance cards rendered once
- [ ] VAT cards conditionally rendered
- [ ] Visual output identical

## Work Log
| 2026-01-27 | Approved | Triage: verified and approved for work |
| Date | Action | Notes |
|------|--------|-------|
| 2026-01-27 | Created | From multi-agent code review of VAT implementation |
