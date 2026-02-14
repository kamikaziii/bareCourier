---
status: complete
priority: p2
issue_id: "333"
tags: [performance, database, code-review]
dependencies: []
---

# Redundant courier_public_profile query in requestReschedule action

## Problem Statement

The `requestReschedule` server action queries `courier_public_profile` for data that's already available from the page's load function. This is an unnecessary extra database round-trip.

## Proposed Solutions

### Option 1: Pass data from load function via form data or page state
- **Effort**: Small | **Risk**: Low

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review
**Actions:**
- Identified by performance-oracle agent

### 2026-02-13 - Closed after verification — finding is invalid
**By:** Claude Code (verification pass)
**Reason:** In SvelteKit, server actions receive ONLY FormData, NOT PageData from the load function. The action legitimately needs its own database query. The proposed fix (passing data via hidden form fields) would mean trusting client-sent data for authorization decisions (`past_due_settings`), which is a security regression. The query is architecturally necessary.

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
