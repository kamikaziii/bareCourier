---
status: ready
priority: p2
issue_id: "081"
tags: [performance, data, index]
dependencies: []
---

# Missing Index on request_status

## Problem Statement
Queries services by request_status='pending' without index.

## Findings
- Location: `src/routes/courier/requests/+page.server.ts:48`
- Requests page filters by request_status
- No index for efficient lookup

## Proposed Solutions

### Option 1: Add partial index
- **Pros**: Efficient for pending status queries
- **Cons**: Index overhead
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Add index on services(request_status) WHERE deleted_at IS NULL

## Technical Details
- **Affected Files**: New migration
- **Database Changes**: Yes - CREATE INDEX

## Acceptance Criteria
- [ ] Index created
- [ ] Query performance improved

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (data warning)
