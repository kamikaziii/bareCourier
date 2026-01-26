---
status: ready
priority: p2
issue_id: "085"
tags: [performance, data]
dependencies: []
---

# notifyCourier Queries Profiles Every Time

## Problem Statement
notifyCourier queries profiles table to find courier on every notification send.

## Findings
- Location: `src/routes/client/+page.server.ts:16`
- Only one courier in system
- Redundant query every notification

## Proposed Solutions

### Option 1: Cache courier ID
- **Pros**: Eliminates redundant queries
- **Cons**: Need to handle cache invalidation (unlikely with single courier)
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Cache courier ID at application startup or in environment

## Technical Details
- **Affected Files**: src/routes/client/+page.server.ts
- **Database Changes**: No

## Acceptance Criteria
- [ ] Courier ID cached
- [ ] No profile query per notification

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (data warning)
