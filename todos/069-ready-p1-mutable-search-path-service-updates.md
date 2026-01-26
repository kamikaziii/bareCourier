---
status: ready
priority: p1
issue_id: "069"
tags: [security, database]
dependencies: []
---

# Mutable search_path in check_client_service_update_fields

## Problem Statement
check_client_service_update_fields() uses 'search_path = public' which is mutable.

## Findings
- Location: `supabase/migrations/023_restrict_client_service_updates.sql:17`
- Same issue as CRIT-007
- Potential privilege escalation

## Proposed Solutions

### Option 1: Change to empty search_path
- **Pros**: Prevents schema poisoning
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Create migration to ALTER FUNCTION with SET search_path = ''

## Technical Details
- **Affected Files**: New migration required
- **Database Changes**: Yes - ALTER FUNCTION

## Acceptance Criteria
- [ ] Function has SET search_path = ''
- [ ] Supabase security advisor passes

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System
**Actions:** Issue approved during triage session

## Notes
Source: Full codebase review 2026-01-26 (CRIT-008)
