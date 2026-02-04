---
status: complete
priority: p3
issue_id: "228"
tags: [ux, i18n, toast, greptile]
dependencies: []
---

# Use Specific Toast Message for Service Type Toggle

## Problem Statement
ServiceTypesSection.svelte uses generic `m.toast_pricing_saved()` instead of the specific `m.toast_service_type_updated()` message for toggle operations.

## Findings
- Location: `src/routes/courier/settings/ServiceTypesSection.svelte:240`
- Toggle is an update operation, should use `toast_service_type_updated`
- User sees "Pricing saved" when toggling a service type active/inactive

## Proposed Solutions

### Option 1: Replace with specific toast message
- **Pros**: More descriptive, better UX, message already exists
- **Cons**: None
- **Effort**: Small (< 5 minutes)
- **Risk**: Low

## Recommended Action
Replace `toast.success(m.toast_pricing_saved())` with `toast.success(m.toast_service_type_updated())` at line 240.

## Technical Details
- **Affected Files**: `src/routes/courier/settings/ServiceTypesSection.svelte`
- **Related Components**: Toast notification system
- **Database Changes**: No

## Resources
- Original finding: Greptile code review on PR #16

## Acceptance Criteria
- [ ] Toast shows "Service type updated" when toggling a service type
- [ ] Translations work for both EN and PT-PT

## Work Log

### 2026-02-04 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status set to ready

## Notes
Source: Greptile code review on PR #16 (feat/toast-system)
