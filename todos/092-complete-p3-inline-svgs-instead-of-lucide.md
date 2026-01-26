---
status: ready
priority: p3
issue_id: "092"
tags: [frontend, consistency]
dependencies: []
---

# Inline SVGs Instead of Lucide Components

## Problem Statement
Multiple files use inline SVG icons instead of importing from @lucide/svelte.

## Findings

**VERIFIED 2026-01-26**: Only 1 inline SVG found (not 5 as originally stated):
- src/routes/courier/settings/PricingTab.svelte:342 - edit icon

Other locations appear to have been fixed or were incorrect.

## Proposed Solutions

### Option 1: Import from @lucide/svelte
- **Pros**: Consistency, smaller bundle
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Import icons from @lucide/svelte for consistency

## Technical Details
- **Affected Files**: Multiple components
- **Database Changes**: No

## Acceptance Criteria
- [ ] All inline SVGs replaced with Lucide imports
- [ ] Consistent icon usage

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (frontend warning)
