---
status: complete
priority: p2
issue_id: "127"
tags: [code-review, quality, duplication]
dependencies: []
---

# CSV Export Code Duplication in Billing Page

## Problem Statement
Two complete CSV export branches (~50 LOC each) in `billing/[client_id]/+page.svelte` share ~70% logic. One branch handles VAT-enabled export, the other non-VAT. The shared parts (date formatting, service iteration, file download) are duplicated.

## Findings
- Source: Pattern Recognition Specialist, Code Simplicity Reviewer
- Location: `src/routes/courier/billing/[client_id]/+page.svelte` ~line 217

## Proposed Solutions

### Option A: Single export function with conditional columns (Recommended)
- Build column headers and row values conditionally based on `vatEnabled`
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] Single CSV export function handles both VAT and non-VAT
- [ ] Output identical to current implementation for both cases
- [ ] No duplicated logic

## Work Log
| 2026-01-27 | Approved | Triage: verified and approved for work |
| Date | Action | Notes |
|------|--------|-------|
| 2026-01-27 | Created | From multi-agent code review of VAT implementation |
