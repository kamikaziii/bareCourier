---
status: ready
priority: p3
issue_id: 291
tags: [code-review, pr-18, dead-code, cleanup]
dependencies: []
---

# Dead code cleanup in geocoding.ts

## Problem Statement

The Mapbox v5 to v6 migration left behind several dead types and fields that are never read by any code in the codebase. This adds cognitive load and suggests these fields matter when they don't.

## Findings

- Simplicity and pattern agents both flagged this
- `GeocodingResponse` interface: exported, zero importers (v5 remnant)
- `GeocodingResult.relevance`: hardcoded to 1, never read by any consumer
- `ReverseGeocodeResult.district`: never consumed by any caller
- `ReverseGeocodeResult.fullAddress`: never consumed by any caller
- `MapboxV6Properties.feature_type`: never accessed
- `MapboxV6Properties.coordinates`: never accessed (geometry.coordinates used instead)
- `MapboxV6Properties.context.place`: never accessed
- `MapboxV6Properties.context.country`: never accessed
- Estimated ~18 LOC removable

**Location:** `src/lib/services/geocoding.ts`

## Proposed Solutions

### Option A: Remove all dead code
Strip unused exports, interfaces, and fields. Type only what the code actually reads.

- **Effort:** Small
- **Risk:** None (confirmed zero references for all items)

## Technical Details

**Affected files:**
- `src/lib/services/geocoding.ts`

**Acceptance Criteria:**
- [ ] `GeocodingResponse` interface removed
- [ ] `relevance` removed from `GeocodingResult` and mapper
- [ ] `district`/`fullAddress` removed from `ReverseGeocodeResult`
- [ ] Unused fields removed from `MapboxV6Properties`

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-13 | Created from PR #18 code review | Simplicity + pattern agents |
