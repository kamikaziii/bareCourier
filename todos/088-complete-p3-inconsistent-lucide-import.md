---
status: ready
priority: p3
issue_id: "088"
tags: [frontend, consistency]
dependencies: []
---

# Inconsistent Lucide Import Path

## Problem Statement
OfflineIndicator imports from 'lucide-svelte' instead of '@lucide/svelte'.

## Findings
- Location: `src/lib/components/OfflineIndicator.svelte:3`
- Rest of codebase uses '@lucide/svelte'
- Inconsistent import paths

## Proposed Solutions

### Option 1: Standardize import
- **Pros**: Consistency
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Change import from 'lucide-svelte' to '@lucide/svelte'

## Technical Details
- **Affected Files**: src/lib/components/OfflineIndicator.svelte
- **Database Changes**: No

## Acceptance Criteria
- [ ] Import path standardized

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (frontend warning)
