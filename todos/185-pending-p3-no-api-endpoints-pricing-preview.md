---
status: pending
priority: p3
issue_id: "185"
tags: [code-review, agent-native, api, pr-7]
dependencies: []
---

# No API Endpoints for Pricing Preview

## Problem Statement

The pricing calculation functions are only available as TypeScript imports, not as HTTP API endpoints. An AI agent or external system cannot estimate prices before creating a service.

## Findings

**Source:** Agent-Native Reviewer Agent

**Missing Capabilities:**
- Calculate price estimate given service parameters
- Check if delivery address is in/out of zone
- Get available service types programmatically

**Impact:**
- AI agents can't preview pricing for users
- External integrations cannot use pricing API
- Limited automation possibilities

## Proposed Solutions

### Solution 1: Add API endpoints
```
GET /api/pricing/estimate?serviceTypeId=...&hasTimePreference=...&isOutOfZone=...
GET /api/pricing/zone-check?municipality=...
GET /api/service-types
GET /api/distribution-zones
```
- **Pros:** Full programmatic access
- **Cons:** New endpoints to maintain
- **Effort:** Medium
- **Risk:** Low

### Solution 2: Add form actions for queries
```
?/previewPrice
?/checkZone
?/getServiceTypes
```
- **Pros:** Uses existing SvelteKit patterns
- **Cons:** Less RESTful
- **Effort:** Small
- **Risk:** Low

## Technical Details

**New Files:**
- `src/routes/api/pricing/estimate/+server.ts`
- `src/routes/api/pricing/zone-check/+server.ts`
- `src/routes/api/service-types/+server.ts`

## Acceptance Criteria

- [ ] Price estimation available via API
- [ ] Zone check available via API
- [ ] Service types queryable via API

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by agent-native-reviewer agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
