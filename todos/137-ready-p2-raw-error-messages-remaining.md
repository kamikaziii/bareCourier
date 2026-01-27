---
status: ready
priority: p2
issue_id: "137"
tags: [security, error-handling]
dependencies: []
---

# Raw Supabase Error Messages Still Leaked in 4 Form Actions

## Problem Statement
`fail(500, { error: insertError.message })` returns raw Supabase errors to the client in 4 remaining locations. Todo #130 fixed this in settings but missed these.

## Findings
- Source: Security Sentinel (full review 2026-01-27)
- Locations:
  - `src/routes/client/new/+page.server.ts:135`
  - `src/routes/courier/services/[id]/+page.server.ts:152`
  - `src/routes/courier/services/+page.server.ts:129`
  - `src/routes/courier/services/+page.server.ts:179`
- Leaks constraint names, table structure to client

## Proposed Solutions

### Option 1: Replace with generic error messages
- Replace `insertError.message` with `'Failed to create service'` / `'Failed to update service'`
- Log actual error server-side with `console.error()`
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Acceptance Criteria
- [ ] No form action returns raw Supabase error messages
- [ ] Generic user-facing error messages used instead
- [ ] Actual errors logged server-side
