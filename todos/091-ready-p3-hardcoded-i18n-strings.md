---
status: ready
priority: p3
issue_id: "091"
tags: [frontend, i18n]
dependencies: []
---

# Hardcoded Portuguese/English Text Not Using i18n

## Problem Statement
Several hardcoded strings not using i18n message functions.

## Findings
- Locations:
  - src/routes/courier/requests/+page.svelte:250 - 'pedidos'
  - src/routes/courier/requests/+page.svelte:367 - 'Atual:', 'Novo:'
  - src/lib/components/SchedulePicker.svelte:148 - 'Limpar data'
  - src/lib/components/Sidebar.svelte:68 - 'Collapse'

## Proposed Solutions

### Option 1: Create i18n message keys
- **Pros**: Proper internationalization
- **Cons**: Need to add translations
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Create i18n message keys for all hardcoded strings

## Technical Details
- **Affected Files**: Multiple components
- **Database Changes**: No

## Acceptance Criteria
- [ ] All hardcoded strings use i18n
- [ ] Translations added

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (frontend warning)
