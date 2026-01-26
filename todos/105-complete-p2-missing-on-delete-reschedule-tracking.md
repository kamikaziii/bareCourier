---
status: ready
priority: p2
issue_id: "105"
tags: [database, data-integrity]
dependencies: []
---

# Foreign Key Missing ON DELETE Action (Reschedule Tracking)

## Problem Statement
last_rescheduled_by references profiles(id) but has no ON DELETE action, could leave dangling references.

## Findings
- Location: `supabase/migrations/024_add_reschedule_tracking.sql:9`
- No ON DELETE action specified
- Profile deletion could leave orphaned references

## Proposed Solutions

### Option 1: Add ON DELETE SET NULL
- **Pros**: Graceful handling of profile deletions
- **Cons**: Loses who rescheduled
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Add ON DELETE SET NULL to handle profile deletions gracefully

## Technical Details
- **Affected Files**: New migration to alter FK
- **Database Changes**: Yes - ALTER TABLE

## Acceptance Criteria
- [ ] FK has ON DELETE SET NULL
- [ ] Profile deletion doesn't fail

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (migration warning)
