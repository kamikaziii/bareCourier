---
status: ready
priority: p3
issue_id: "107"
tags: [database, consistency]
dependencies: []
---

# Inconsistent Use of is_courier() Helper

## Problem Statement
Pricing migrations use inline subquery for courier check instead of is_courier() function.

## Findings
- Locations:
  - supabase/migrations/014_create_client_pricing.sql:21
  - supabase/migrations/015_create_pricing_zones.sql:22
  - supabase/migrations/016_create_urgency_fees.sql:30
- Inconsistent with other tables that use is_courier()

## Proposed Solutions

### Option 1: Update to use is_courier()
- **Pros**: Consistency, benefits from SECURITY DEFINER optimization
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Use public.is_courier() consistently across all RLS policies

## Technical Details
- **Affected Files**: New migration to update policies
- **Database Changes**: Yes - DROP/CREATE POLICY

## Acceptance Criteria
- [ ] All policies use is_courier()
- [ ] Consistent pattern across tables

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (migration warning)
