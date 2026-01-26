---
status: ready
priority: p3
issue_id: "066"
tags: [performance, data]
dependencies: []
---

# Sequential Queries in Client Edit Load

## Problem Statement
Three sequential queries in load function: profiles, client_pricing, pricing_zones.

## Findings
- Location: `src/routes/courier/clients/[id]/edit/+page.server.ts:13`
- Same pattern as client detail page
- Unnecessary latency on page load

## Proposed Solutions

### Option 1: Partial Promise.all (Recommended)
- **Pros**: Reduces latency while maintaining error handling
- **Cons**: Client query must run first (dependency)
- **Effort**: Small
- **Risk**: Low

**VERIFIED 2026-01-26**: Cannot fully parallelize - client query must succeed first (error 404 if not found). After client succeeds, the remaining 2 queries (pricing, zones) can run in parallel.

## Recommended Action
1. Fetch client profile first (need to validate it exists)
2. Then Promise.all for client_pricing, pricing_zones

## Technical Details
- **Affected Files**: src/routes/courier/clients/[id]/edit/+page.server.ts
- **Database Changes**: No

## Acceptance Criteria
- [ ] All queries execute in parallel
- [ ] Page load time reduced

## Work Log

### 2026-01-26 - Approved for Work
**By:** Claude Triage System
**Actions:** Issue approved during triage session

### 2026-01-26 - Downgraded P1 → P3
**By:** Claude Verification
**Reason:** Single-entity page with fixed 3 queries regardless of scale. Minor latency optimization, not a scaling bottleneck.

## Notes
Source: Full codebase review 2026-01-26 (CRIT-005)
