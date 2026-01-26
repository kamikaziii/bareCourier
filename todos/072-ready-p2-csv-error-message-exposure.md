---
status: ready
priority: p2
issue_id: "072"
tags: [security, api]
dependencies: []
---

# Database Error Message Exposed in CSV Export

## Problem Statement
Database error message exposed directly to client response in CSV export endpoint.

## Findings
- Location: `src/routes/api/reports/csv/+server.ts:47`
- Raw Supabase error messages sent to client
- May leak implementation details

## Proposed Solutions

### Option 1: Generic error response
- **Pros**: No information leakage
- **Cons**: Less debugging info for client
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Return generic error message to client, log detailed error server-side

## Technical Details
- **Affected Files**: src/routes/api/reports/csv/+server.ts
- **Database Changes**: No

## Acceptance Criteria
- [ ] Generic error message returned to client
- [ ] Detailed error logged server-side

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (security warning)
