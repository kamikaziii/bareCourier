---
status: ready
priority: p2
issue_id: "280"
tags: [security, rls, database]
dependencies: []
---

# service_types_select_client RLS Allows Anonymous Access

## Problem Statement
`service_types_select_client` policy (migration line 30-32) has no `TO authenticated` clause. PostgreSQL defaults to `TO PUBLIC` which includes the `anon` role. Unauthenticated API callers can read all active service types and prices.

## Findings
- Location: `supabase/migrations/20260129130000_add_service_types_table.sql:30-32`
- Compare with correct pattern in `20260129140000`: `USING (auth.uid() IS NOT NULL)`
- Courier SELECT policy on same table is properly restricted

## Proposed Solutions

### Option 1: Drop and recreate policy with auth check
- `DROP POLICY "service_types_select_client" ON service_types`
- `CREATE POLICY ... USING (active = true AND auth.uid() IS NOT NULL)`
- **Pros**: Restricts to authenticated users
- **Cons**: None
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Recommended Action
Create migration to replace policy with authenticated-only check.

## Technical Details
- **Affected Files**: New migration file
- **Database Changes**: Yes — RLS policy replacement

## Acceptance Criteria
- [ ] Unauthenticated requests cannot read service types
- [ ] Authenticated clients can still see active service types
- [ ] Courier access unaffected

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06
