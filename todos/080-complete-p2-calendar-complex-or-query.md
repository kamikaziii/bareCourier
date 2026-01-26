---
status: complete
priority: p2
issue_id: "080"
tags: [performance, data, index]
dependencies: []
---

# Complex OR Query May Not Use Indexes Efficiently

## Problem Statement
Complex OR query on services table may not use indexes efficiently.

## Findings
- Location: `src/routes/courier/calendar/+page.server.ts:40`
- OR query on scheduled_date + created_at conditions
- Index usage uncertain

## Proposed Solutions

### Option 1: Composite index
- **Pros**: Optimizes query
- **Cons**: Index storage overhead
- **Effort**: Small
- **Risk**: Low

### Option 2: Split into two queries
- **Pros**: Clearer index usage
- **Cons**: More code complexity
- **Effort**: Medium
- **Risk**: Low

## Recommended Action
Add composite index on (scheduled_date, created_at, deleted_at)

## Technical Details
- **Affected Files**: New migration
- **Database Changes**: Yes - CREATE INDEX

## Acceptance Criteria
- [x] Index added
- [x] Query performance verified with EXPLAIN

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

### 2026-01-26 - Completed
**By:** Claude Code

Applied migration `add_calendar_composite_index` creating:
```sql
CREATE INDEX idx_services_calendar ON services(scheduled_date, created_at, deleted_at);
```

Index verified in database:
```
idx_services_calendar | CREATE INDEX idx_services_calendar ON public.services USING btree (scheduled_date, created_at, deleted_at)
```

## Notes
Source: Full codebase review 2026-01-26 (data warning)
