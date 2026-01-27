---
status: complete
priority: p2
issue_id: "142"
tags: [architecture, type-safety, database]
dependencies: []
---

# Auto-Generate Database Types from Supabase CLI

## Problem Statement
`database.types.ts` is manually maintained (~600 lines) with Row/Insert/Update per table. Manual types drift from actual schema — fields added in migrations can be forgotten in types. SYNC WARNING comments confirm this is already a pain point.

## Findings
- Source: Architecture Strategist (full review 2026-01-27)
- Location: `src/lib/database.types.ts`
- Evidence: SYNC WARNING comments at lines 35, 37

## Proposed Solutions

### Option 1: Use supabase gen types + re-export aliases
- Run `supabase gen types typescript` to auto-generate base types
- Create `src/lib/database.helpers.ts` re-exporting Profile, Service, etc.
- Add npm script: `"types:generate": "supabase gen types typescript --project-id $PROJECT_ID > src/lib/database.generated.ts"`
- **Effort**: Medium (2-3 hours)
- **Risk**: Medium — need to reconcile hand-authored helper types

## Acceptance Criteria
- [ ] Base types auto-generated from Supabase CLI
- [ ] Helper aliases (Profile, Service, etc.) re-exported from separate file
- [ ] npm script for regeneration
- [ ] Build passes with generated types
