---
status: complete
priority: p1
issue_id: "125"
tags: [code-review, security, validation, vat]
dependencies: []
---

# Missing Server-Side VAT Rate Range Validation

## Problem Statement
`+page.server.ts:441-442` does not validate that `vat_rate` is within 0-100 before the DB call. The DB CHECK constraint catches invalid values, but the raw Supabase error message leaks constraint names and table structure to the client.

## Findings
- Source: Security Sentinel
- Location: `src/routes/courier/settings/+page.server.ts` lines 441-442
- DB constraint exists (`profiles_vat_rate_check`) but error message is exposed raw

## Proposed Solutions

### Option A: Add server-side validation before DB call (Recommended)
- Add `if (vat_enabled && (vat_rate === null || vat_rate < 0 || vat_rate > 100)) return fail(400, { error: 'VAT rate must be between 0 and 100' })`
- **Effort**: Small
- **Risk**: Low

### Option B: Wrap DB error with generic message
- Catch Supabase errors and return user-friendly message
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] Server rejects vat_rate outside 0-100 with user-friendly message
- [ ] No raw DB error messages exposed to client
- [ ] Valid values still save correctly

## Work Log
| 2026-01-27 | Approved | Triage: verified and approved for work |
| Date | Action | Notes |
|------|--------|-------|
| 2026-01-27 | Created | From multi-agent code review of VAT implementation |
