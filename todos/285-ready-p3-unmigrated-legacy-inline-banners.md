---
status: ready
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
- [ ] All 5 locations use toast instead of inline banners
- [ ] No hardcoded English strings
- [ ] forgot-password shows only toast OR inline banner, not both

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06
