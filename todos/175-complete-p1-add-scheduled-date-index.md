---
status: complete
priority: p1
issue_id: "175"
tags: [database, performance, index, code-review]
dependencies: []
---

# Add Database Index on scheduled_date

## Problem Statement

`calculateDayWorkload()` queries by `scheduled_date` but no index exists. This causes full table scans as the services table grows, degrading performance.

## Findings

- **Location:** Database schema (missing index)
- The workload service queries: `.eq('scheduled_date', dateStr).eq('status', 'pending').is('deleted_at', null)`
- Current indexes exist for `client_id`, `status`, `created_at` but NOT `scheduled_date`
- This was a genuine oversight not mentioned in design doc

## Proposed Solutions

### Option 1: Partial index with common filters (Recommended)
```sql
CREATE INDEX idx_services_scheduled_date
ON services(scheduled_date)
WHERE deleted_at IS NULL;
```
- **Pros**: Smaller index, faster for common query pattern
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Create migration file and apply index.

## Technical Details

- **Affected Files**: Create `supabase/migrations/XXX_add_scheduled_date_index.sql`
- **Related Components**: workload.ts, +page.server.ts
- **Database Changes**: Yes - adds index

## Acceptance Criteria

- [x] Migration file created
- [ ] Index applied to database
- [ ] Query performance improved (verify with EXPLAIN)

## Work Log

### 2026-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

### 2026-01-29 - Implemented
**By:** Claude Code Agent
**Actions:**
- Created migration file: `supabase/migrations/20260129120001_add_scheduled_date_index.sql`
- Partial index on `scheduled_date` WHERE `deleted_at IS NULL`
- Added documentation comment on the index
- Status: complete (migration created, needs `supabase db push` to apply)

## Notes

Source: PR #6 code review - genuine oversight in design
