---
status: pending
priority: p3
issue_id: "328"
tags: [duplication, code-review]
dependencies: []
---

# defaultCenter coordinates duplicated across 4 files

## Problem Statement

The default map center coordinates (Lisbon area) are duplicated in 4 different component files. Should be a shared constant.

## Proposed Solutions

### Option 1: Extract to shared constant in $lib/constants.ts
- **Effort**: Small | **Risk**: Low

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
