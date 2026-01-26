---
status: ready
priority: p3
issue_id: "099"
tags: [architecture, dry]
dependencies: []
---

# Identical Duplicate Layout (Client/Courier)

## Problem Statement
Client +layout.ts is identical duplicate of courier layout load function.

## Findings
- Location: `src/routes/client/+layout.ts`
- Same data merging pattern as courier layout
- Violates DRY principle

## Proposed Solutions

### Option 1: Extract shared logic
- **Pros**: DRY, single source of truth
- **Cons**: Minor refactor
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Extract shared layout logic to $lib helper function

## Technical Details
- **Affected Files**: src/routes/client/+layout.ts, src/routes/courier/+layout.ts, new $lib helper
- **Database Changes**: No

## Acceptance Criteria
- [ ] Shared helper created
- [ ] Both layouts use helper
- [ ] No duplication

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (architecture warning)
