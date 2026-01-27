---
status: complete
priority: p3
issue_id: "130"
tags: [code-review, security, error-handling]
dependencies: []
---

# Raw DB Error Messages Exposed to Client

## Problem Statement
`+page.server.ts:461` returns `error.message` verbatim from Supabase, potentially leaking constraint names and table structure. Pre-existing issue, not VAT-specific.

## Findings
- Source: Security Sentinel
- Location: `src/routes/courier/settings/+page.server.ts:461`

## Proposed Solutions

### Option A: Replace with generic error message
- Return `'Failed to save preferences. Please try again.'`
- Log original error server-side
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] No raw DB errors reach the client
- [ ] Errors logged server-side for debugging

## Work Log
| 2026-01-27 | Approved | Triage: verified and approved for work |
| Date | Action | Notes |
|------|--------|-------|
| 2026-01-27 | Created | From multi-agent code review of VAT implementation |
