---
status: ready
priority: p2
issue_id: "083"
tags: [data-integrity]
dependencies: []
---

# Missing Transaction Boundary in Reschedule Action

## Problem Statement
Reschedule action updates services, inserts reschedule_history, and inserts notification as separate operations without transaction.

## Findings
- Location: `src/routes/courier/services/[id]/+page.server.ts:198`
- Multiple table operations not atomic
- Partial failure leaves inconsistent state

## Proposed Solutions

### Option 1: Wrap in transaction
- **Pros**: Ensures atomicity
- **Cons**: Supabase client doesn't support transactions directly
- **Effort**: Medium
- **Risk**: Low

### Option 2: Create RPC function
- **Pros**: True atomicity in database
- **Cons**: More complex
- **Effort**: Medium
- **Risk**: Low

## Recommended Action
Wrap related operations in RPC function for atomicity

## Technical Details
- **Affected Files**: src/routes/courier/services/[id]/+page.server.ts, new migration
- **Database Changes**: Yes - CREATE FUNCTION

## Acceptance Criteria
- [ ] All reschedule operations atomic
- [ ] Partial failures roll back

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (data warning)
