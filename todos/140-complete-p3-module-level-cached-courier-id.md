---
status: complete
priority: p3
issue_id: "140"
tags: [architecture, serverless]
dependencies: []
---

# Module-Level Cached Courier ID in Serverless Environment

## Problem Statement
`cachedCourierId` stored at module scope persists across requests in the same Vercel function instance but not across instances. Fragile pattern — works only because there's exactly one courier.

## Findings
- Source: Performance Oracle (full review 2026-01-27)
- Location: `src/routes/client/+page.server.ts:6-24`
- Pattern: `let cachedCourierId: string | null = null` at module level

## Proposed Solutions

### Option 1: Remove module-level cache, accept query cost
- Single row by role, indexed — negligible cost
- Remove fragile caching pattern
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Acceptance Criteria
- [ ] No module-level mutable state in server files
- [ ] Courier ID fetched per-request (or use request-scoped cache)
