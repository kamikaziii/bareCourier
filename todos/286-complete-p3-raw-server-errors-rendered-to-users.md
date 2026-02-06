---
status: ready
priority: p3
issue_id: "286"
tags: [ux, i18n, error-handling]
dependencies: []
---

# Raw Server Error Strings Rendered to Users

## Problem Statement
Two locations render `form.error` directly from server actions, exposing raw English error strings to users without localization.

## Findings
- `src/routes/courier/settings/+page.svelte:41-48` — only maps `urgency_in_use`, all other errors pass through raw (40+ fail() calls in server file)
- `src/routes/courier/services/[id]/edit/+page.svelte:280` — renders `form.error` directly

## Proposed Solutions

### Option 1: Map server errors to localized messages
- Use error codes instead of raw strings in server actions
- Map codes to `m.*` functions in the client
- **Effort**: Medium (2 hours)
- **Risk**: Low

## Acceptance Criteria
- [ ] No raw English strings visible to users
- [ ] All server errors mapped to localized messages

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06
