---
status: ready
priority: p2
issue_id: "101"
tags: [architecture, typescript]
dependencies: []
---

# App.PageData Incomplete

## Problem Statement
App.PageData only declares session, but layouts return supabase, profile, and navCounts - incomplete type coverage.

## Findings
- Location: `src/app.d.ts:15`
- Missing supabase client type
- Missing profile type
- Missing navCounts type
- Reduces TypeScript's error catching

## Proposed Solutions

### Option 1: Extend PageData interface
- **Pros**: Full type safety across routes
- **Cons**: Need to determine correct types
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Extend PageData interface to include supabase client, profile, and navCounts

## Technical Details
- **Affected Files**: src/app.d.ts
- **Database Changes**: No

## Acceptance Criteria
- [ ] PageData includes all returned data
- [ ] Type errors caught at compile time

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Full codebase review 2026-01-26 (architecture warning)
