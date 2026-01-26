---
status: ready
priority: p2
issue_id: "102"
tags: [database, data-integrity]
dependencies: []
---

# CASCADE Delete on services.client_id Could Cause Silent Data Loss

## Problem Statement
CASCADE delete on services.client_id could cause silent data loss when profiles are deleted.

## Findings
- Location: `supabase/migrations/001_initial_schema.sql:21`
- Deleting a profile cascades to delete all their services
- No warning or audit trail

## Proposed Solutions

### Option 1: Use RESTRICT or SET NULL
- **Pros**: Prevents accidental data loss
- **Cons**: Requires explicit cleanup logic
- **Effort**: Medium
- **Risk**: Medium (need migration)

## Recommended Action
Consider using RESTRICT or SET NULL with explicit service cleanup logic before profile deletion

## Technical Details
- **Affected Files**: New migration to alter FK constraint
- **Database Changes**: Yes - ALTER TABLE

## Acceptance Criteria
- [ ] FK constraint updated
- [ ] Explicit cleanup logic implemented
- [ ] No silent data loss

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (migration warning)
