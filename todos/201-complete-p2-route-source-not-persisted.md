---
status: complete
priority: p2
issue_id: "201"
tags: [code-review, agent-native, pr-10]
dependencies: []
---

# Route Calculation Source Not Persisted in Database

## Problem Statement

The `source: 'api' | 'haversine'` field from `RouteCalculationResult` is only available during live route calculation. When a service is created, this information is NOT stored in the database.

This means:
- AI agents cannot determine whether an existing service's distance was calculated via API or haversine fallback
- No ability to audit route calculation reliability across service history
- Cannot programmatically identify services with potentially inaccurate distance estimates

## Findings

**Reviewers:** agent-native-reviewer

- `RouteCalculationResult.source` is defined in route.ts:22
- Form pages use `routeSource` state variable during creation
- Server action in `+page.server.ts` does NOT include `route_source` in the insert
- Users see a warning during form entry, but info is lost after creation

## Proposed Solutions

### Option A: Add Column to Services Table (Recommended)

```sql
ALTER TABLE services
ADD COLUMN route_calculation_source text
CHECK (route_calculation_source IN ('api', 'haversine'));
```

Update form actions to persist this value.

- **Pros:** Full audit trail, agent accessible
- **Cons:** Schema change, migration needed
- **Effort:** Medium (1 hour)
- **Risk:** Low

### Option B: Store in price_breakdown JSONB (IMPLEMENTED)

Add to existing `price_breakdown` column:
```json
{"route_source": "haversine", ...}
```

- **Pros:** No schema change
- **Cons:** Less queryable, inconsistent structure
- **Effort:** Small (30 mins)
- **Risk:** Low

## Technical Details

**Files modified:**
- `src/lib/database.types.ts` - Added `route_source` field to `PriceBreakdown` type
- `src/lib/services/distance.ts` - Added `source` field to `ServiceDistanceResult` interface (already existed, tracking api vs haversine)
- `src/routes/courier/services/new/+page.server.ts` - Include `route_source` in price_breakdown
- `src/routes/client/new/+page.server.ts` - Include `route_source` in price_breakdown
- `src/routes/courier/services/[id]/edit/+page.server.ts` - Include `route_source` in price_breakdown
- `src/routes/client/services/[id]/edit/+page.server.ts` - Updated type for consistency

## Acceptance Criteria

- [x] Route calculation source is stored when service is created
- [x] Can query for all services with haversine fallback (via `price_breakdown->>'route_source'`)
- [x] Agents can determine calculation method for existing services

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |
| 2026-02-01 | Implemented Option B | Added `route_source` to `price_breakdown` JSONB |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
