---
status: complete
priority: p2
issue_id: "126"
tags: [code-review, data-integrity, vat]
dependencies: []
---

# VAT Rate NULL/Default Mismatch Between UI and DB

## Problem Statement
When VAT is disabled, `vat_rate` is set to NULL in DB. When re-enabled, UI shows `profile.vat_rate ?? 23` (defaults to 23) but service creation uses `courierSettings.vatRate ?? 0` (snapshots 0). The user sees 23% in the UI but services get 0% snapshots until they explicitly save.

## Findings
- Source: Data Integrity Guardian
- UI default: `PricingTab.svelte` → `profile.vat_rate ?? 23`
- Service creation fallback: `courierSettings.vatRate ?? 0`
- DB stores NULL when VAT disabled

## Proposed Solutions

### Option A: Preserve vat_rate in DB when disabling VAT (Recommended)
- Only set `vat_enabled = false`, keep `vat_rate` value intact
- **Effort**: Small
- **Risk**: Low

### Option B: Align all fallbacks to same default
- Change service creation to also use 23 as fallback
- Extract constant `DEFAULT_VAT_RATE = 23`
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] Disabling and re-enabling VAT preserves the rate value
- [ ] UI default matches service creation fallback
- [ ] No scenario where user sees different rate than what gets snapshotted

## Work Log
| 2026-01-27 | Approved | Triage: verified and approved for work |
| Date | Action | Notes |
|------|--------|-------|
| 2026-01-27 | Created | From multi-agent code review of VAT implementation |
