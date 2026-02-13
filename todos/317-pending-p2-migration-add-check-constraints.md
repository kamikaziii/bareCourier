---
status: pending
priority: p2
issue_id: 317
tags: [code-review, data-integrity, pr-20]
dependencies: []
---

# Migration: Add CHECK Constraints to client_addresses

## Problem Statement

The `client_addresses` migration creates columns without essential CHECK constraints, allowing invalid data states:
1. Partial coordinates (lat without lng or vice versa)
2. Unbounded text columns (potential storage abuse)
3. Invalid coordinate ranges (lat=999)

## Findings

**File:** `supabase/migrations/20260214000001_create_client_addresses.sql`

**Flagged by:** Data Integrity Guardian, Security Sentinel

### Verified issues:
- **Partial coordinates:** `lat float8, lng float8` are independently nullable. The UI prevents this in practice (both come from `formCoords`), but a direct API call or form tamper could set one without the other. Defense-in-depth at DB level.
- **Unbounded text:** `label text NOT NULL` and `address text NOT NULL` accept megabytes. Labels should be ~100 chars, addresses ~500 chars.
- **Invalid coords:** `lat float8` accepts 999.0. Valid range: -90 to 90 (lat), -180 to 180 (lng).

### Claims from agents that were overstated (removed):
- **`created_at NOT NULL`**: The project uses BOTH nullable and NOT NULL `created_at` across tables. Not an inconsistency. Tables like `break_logs`, `service_types`, `notifications`, `push_subscriptions` all use nullable `created_at`. Adding `NOT NULL` is fine but is not fixing an inconsistency.
- **`updated_at` column**: Most simple CRUD tables in the project (`notifications`, `urgency_fees`, `pricing_zones`, `distribution_zones`, `break_logs`, `push_subscriptions`) do NOT have `updated_at`. Only complex state-machine tables (`services`, `client_pricing`) do. For a simple address book, `updated_at` is YAGNI.

## Proposed Solution

Add constraints to migration:
```sql
CREATE TABLE client_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  address text NOT NULL CHECK (char_length(address) BETWEEN 1 AND 500),
  lat float8,
  lng float8,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT lat_lng_both_or_neither CHECK (
    (lat IS NULL AND lng IS NULL) OR (lat IS NOT NULL AND lng IS NOT NULL)
  ),
  CONSTRAINT valid_lat CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  CONSTRAINT valid_lng CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180))
);
```

Also add length validation in server actions:
```typescript
if (label.length > 100) return fail(400, { error: 'Label too long' });
if (address.length > 500) return fail(400, { error: 'Address too long' });
```

- **Effort:** Small (modify migration before first deploy)
- **Risk:** None (new table, no existing data)

## Acceptance Criteria

- [ ] Partial coordinates rejected by DB
- [ ] Labels over 100 chars rejected by DB and server action
- [ ] Addresses over 500 chars rejected by DB and server action
- [ ] Invalid lat/lng ranges rejected by DB
- [ ] Server-side form actions validate length before DB call

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #20 code review | |
| 2026-02-13 | Verified: created_at NOT NULL and updated_at claims were overstated -- removed | Project uses both patterns; YAGNI for simple tables |

## Resources

- [PR #20](https://github.com/kamikaziii/bareCourier/pull/20)
