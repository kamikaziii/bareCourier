---
status: ready
priority: p1
issue_id: "273"
tags: [bug, notifications, cron, critical]
dependencies: []
---

# Daily Summary Deduplication Uses Wrong Column Name

## Problem Statement
`daily-summary/index.ts:134` queries `.eq('category', 'daily_summary')` but the `notifications` table column is `type`, not `category`. PostgREST returns 400 for the unknown column. Since only `data` is destructured (no error check), `existingSummary` is always `null`. The dedup guard never fires, causing duplicate daily summaries on every cron invocation.

## Findings
- Location: `supabase/functions/daily-summary/index.ts:134`
- Column confirmed as `type` in migration `20260121000011:5` and `database.generated.ts:249`
- Error is silently swallowed because only `{ data }` is destructured, not `{ data, error }`

## Proposed Solutions

### Option 1: Fix column name
- Change `.eq('category', 'daily_summary')` to `.eq('type', 'daily_summary')`
- **Pros**: Single-line fix
- **Cons**: None
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action
Fix the column name from `category` to `type`.

## Technical Details
- **Affected Files**: `supabase/functions/daily-summary/index.ts`
- **Related Components**: Cron job, notification system
- **Database Changes**: No

## Acceptance Criteria
- [ ] Daily summary only sends once per day even if cron fires multiple times
- [ ] Deduplication query executes without PostgREST error

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06
