---
status: complete
priority: p3
issue_id: "326"
tags: [database, naming, code-review]
dependencies: []
---

# Trigger naming inconsistency — trg_ prefix only on notification trigger

## Problem Statement

The notification update trigger (000006) uses `trg_restrict_notification_updates` prefix while other triggers use no prefix: `restrict_service_updates`, `restrict_client_profile_updates`. Inconsistent naming convention.

## Proposed Solutions

### Option 1: Standardize naming in future migrations
- **Effort**: Small | **Risk**: Low

## Acceptance Criteria
- [ ] Naming convention documented
- [ ] Future triggers follow convention

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
