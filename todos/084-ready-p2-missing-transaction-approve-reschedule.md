---
status: ready
priority: p2
issue_id: "084"
tags: [data-integrity]
dependencies: []
---

# Missing Transaction Boundary in approveReschedule

## Problem Statement
approveReschedule updates services then service_reschedule_history separately without transaction.

## Findings
- Location: `src/routes/courier/requests/+page.server.ts:344`
- Two separate update operations
- Partial failure leaves inconsistent state

## Proposed Solutions

### Option 1: Create RPC function
- **Pros**: Ensures atomicity
- **Cons**: Requires migration
- **Effort**: Medium
- **Risk**: Low

## Recommended Action
Use RPC function to ensure both operations succeed or fail together

## Technical Details
- **Affected Files**: src/routes/courier/requests/+page.server.ts, new migration
- **Database Changes**: Yes - CREATE FUNCTION

## Acceptance Criteria
- [ ] Both operations atomic
- [ ] Partial failures roll back

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (data warning)
