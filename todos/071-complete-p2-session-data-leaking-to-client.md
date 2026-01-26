---
status: ready
priority: p2
issue_id: "071"
tags: [security]
dependencies: []
---

# Session Data Returned Without Filtering

## Problem Statement
Session data returned to client without filtering sensitive fields - may include tokens.

## Findings
- Location: `src/routes/+layout.server.ts:8`
- Full session object returned to client
- May contain sensitive token data

## Proposed Solutions

### Option 1: Filter session fields
- **Pros**: Only expose necessary data
- **Cons**: Need to verify what client needs
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Only return necessary session fields (user ID, email, role)

## Technical Details
- **Affected Files**: src/routes/+layout.server.ts
- **Database Changes**: No

## Acceptance Criteria
- [ ] Session object filtered before return
- [ ] Only user ID, email, role exposed

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (security warning)
