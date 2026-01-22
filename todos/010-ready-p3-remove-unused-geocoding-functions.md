# Remove Unused Geocoding Functions

---
status: ready
priority: p3
issue_id: "010"
tags: [code-review, simplicity, dead-code]
dependencies: []
---

## Problem Statement

Two functions in `geocoding.ts` are defined but never used:
- `getCoordinates()` (lines 80-86)
- `reverseGeocode()` (lines 94-123)

**Why it matters**: Dead code increases maintenance burden.

## Findings

- **Location**: `src/lib/services/geocoding.ts`
- **Agent**: code-simplicity-reviewer

**Unused Code**: ~49 lines

## Proposed Solutions

### Option 1: Remove Unused Functions (Recommended)
Delete lines 75-123 from `geocoding.ts`.

**Effort**: Trivial
**Risk**: None

## Acceptance Criteria

- [ ] Unused functions removed
- [ ] App still builds and runs
- [ ] Address autocomplete still works

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by code-simplicity-reviewer | Features built but not integrated |
| 2026-01-22 | Approved during triage | Ready for implementation - delete lines 75-123 |
