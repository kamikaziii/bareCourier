---
status: ready
priority: p3
issue_id: "283"
tags: [maintenance, types, database]
dependencies: []
---

# database.generated.ts Missing Email Tracking Columns

## Problem Statement
Migration `20260204000004` added `email_sent_at`, `email_id`, `email_status` to `notifications`, but `database.generated.ts` was never regenerated. Types are out of sync with actual schema.

## Findings
- Location: `src/lib/database.generated.ts:240-289`
- Migration: `supabase/migrations/20260204000004_add_email_tracking_columns.sql`

## Proposed Solutions

### Option 1: Regenerate types
- Run `supabase gen types typescript`
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Acceptance Criteria
- [ ] Generated types include email tracking columns

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06
