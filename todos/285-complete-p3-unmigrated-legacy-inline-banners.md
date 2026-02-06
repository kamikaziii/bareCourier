---
status: complete
priority: p3
issue_id: "285"
tags: [ux, toast, consistency]
dependencies: []
---

# Unmigrated Legacy Inline Banners (5 locations)

## Problem Statement
Five locations still use old inline success/error banner patterns instead of toast, inconsistent with the toast system migration.

## Findings
1. `src/routes/courier/+page.svelte:87-88,431-440` — batch reschedule
2. `src/routes/courier/clients/[id]/ClientInfoTab.svelte:54-55,265-278` — resend invitation
3. `src/routes/courier/clients/[id]/ResetPasswordDialog.svelte:22,105-106` — reset password
4. `src/routes/courier/clients/[id]/ToggleActiveDialog.svelte:18,33,36,39` — toggle active (also has hardcoded English strings)
5. `src/routes/forgot-password/+page.svelte:34+48` — fires BOTH toast AND inline banner simultaneously

## Proposed Solutions

### Option 1: Migrate to toast pattern
- Replace inline banners with `toast.success()` / `toast.error()` calls
- Fix hardcoded English strings in ToggleActiveDialog
- Remove duplicate feedback in forgot-password
- **Effort**: Small (1 hour)
- **Risk**: Low

## Acceptance Criteria
- [x] All 5 locations use toast instead of inline banners
- [x] No hardcoded English strings
- [x] forgot-password shows only toast OR inline banner, not both

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

### 2026-02-06 - Completed
**By:** Claude Code

All 5 locations migrated from inline banners to toast notifications:
1. **courier/+page.svelte** - Removed `batchRescheduleSuccess`/`batchRescheduleError` state vars and banner HTML; replaced with `toast.success()`/`toast.error()` calls
2. **ClientInfoTab.svelte** - Removed `resendError`/`resendSuccess` state vars, cleanup timeout, and banner HTML; replaced with toast calls
3. **ResetPasswordDialog.svelte** - Removed `success`/`error` state vars, success banner, and error banner HTML; dialog now closes on success with toast feedback
4. **ToggleActiveDialog.svelte** - Removed `error` state var, `handleCancel` function, and error banner HTML; replaced hardcoded English strings (`"Failed to update client status"`, `"An unexpected error occurred"`) with `m.toast_error_generic()`; added success toast with `m.toast_client_deactivated()`/`m.toast_client_activated()`
5. **forgot-password/+page.svelte** - Removed duplicate green success banner div while keeping `submitted` state for form hiding; toast already provides the success feedback

## Notes
Source: Comprehensive audit session on 2026-02-06
