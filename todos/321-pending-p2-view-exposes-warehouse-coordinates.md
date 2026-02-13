---
status: pending
priority: p2
issue_id: "321"
tags: [security, privacy, database, code-review]
dependencies: []
---

# courier_public_profile view exposes warehouse_lat/warehouse_lng to clients

## Problem Statement

The `courier_public_profile` view (migration 000005) includes `warehouse_lat` and `warehouse_lng` columns. These expose the courier's physical warehouse location to all authenticated users (including clients). This may be a privacy concern depending on whether the warehouse address is the courier's home.

## Findings

- View selects: `warehouse_lat, warehouse_lng` among other columns
- Clients can query this view and see the courier's coordinates
- If warehouse = home address, this is a personal data exposure

**Location:** `supabase/migrations/20260213000005_restrict_courier_profile_select.sql`

## Proposed Solutions

### Option 1: Remove from view if not needed by clients
- **Pros**: Reduces data exposure
- **Cons**: Need to verify no client-facing features use these
- **Effort**: Small
- **Risk**: Low (verify first)

### Option 2: Accept if warehouse is public business address
- **Pros**: No change needed
- **Cons**: Depends on business context
- **Effort**: None
- **Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Acceptance Criteria
- [ ] Determine if warehouse coordinates are needed by clients
- [ ] If not, remove from view
- [ ] If yes, document the decision

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review
**Actions:**
- Identified by security-sentinel agent

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
