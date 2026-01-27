---
status: complete
priority: p2
issue_id: "139"
tags: [performance, data-layer]
dependencies: []
---

# No Pagination on Client Detail Services Query

## Problem Statement
The client detail page fetches ALL services for a client with no limit or pagination. Stats (pending/delivered counts) are computed in-memory by iterating the full array. A client with thousands of services causes slow loads and high memory usage.

## Findings
- Source: Performance Oracle (full review 2026-01-27)
- Location: `src/routes/courier/clients/[id]/+page.server.ts:25-43`
- Query: `.from('services').select('*').eq('client_id', params.id)` — no `.limit()`
- Stats computed: `allServices.filter(s => s.status === 'pending').length` (lines 42-43)

## Proposed Solutions

### Option 1: Add pagination + DB-side counts
- Add `.limit(50)` with offset-based pagination
- Replace in-memory counts with `.select('status', { count: 'exact', head: true })` queries
- **Effort**: Medium (2-3 hours)
- **Risk**: Low

### Option 2: Server-side RPC for stats
- Create a Postgres function returning counts per status
- Keep paginated service list separate
- **Effort**: Medium (2-3 hours)

## Acceptance Criteria
- [ ] Services query uses pagination (limit + offset)
- [ ] Stats computed via DB aggregation, not in-memory
- [ ] Page loads remain fast with 1000+ services per client
