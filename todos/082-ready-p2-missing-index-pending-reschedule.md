---
status: ready
priority: p2
issue_id: "082"
tags: [performance, data, index]
dependencies: []
---

# Missing Partial Index for pending_reschedule_date

## Problem Statement
Query on pending_reschedule_date IS NOT NULL may be slow without partial index.

## Findings
- Location: `src/routes/courier/requests/+page.server.ts:56`
- Queries for non-null pending_reschedule_date
- No optimized index

## Proposed Solutions

### Option 1: Add partial index
- **Pros**: Efficient for non-null queries
- **Cons**: Index overhead
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Add partial index WHERE pending_reschedule_date IS NOT NULL

## Technical Details
- **Affected Files**: New migration
- **Database Changes**: Yes - CREATE INDEX

## Acceptance Criteria
- [ ] Partial index created
- [ ] Query performance improved

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (data warning)
