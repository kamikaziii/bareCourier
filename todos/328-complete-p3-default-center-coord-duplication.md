---
status: complete
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

### 2026-02-13 - Closed after verification
**By:** Claude Code (verification pass)
**Reason:** The Lisbon coordinates `[-9.1393, 38.7223]` appear only ONCE in `RouteMap.svelte:36` as `LISBON_CENTER`. The "4 files" reference it implicitly via the component's fallback logic. No actual code duplication exists.

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
