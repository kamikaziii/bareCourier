# Non-Atomic Pricing Zone Updates

---
status: complete
priority: p2
issue_id: "001"
tags: [code-review, data-integrity, transaction-safety]
dependencies: []
plan_task: "N/A"
plan_status: "COMPLETED"
---

> **UX PLAN INTEGRATION**: This is a **PREREQUISITE** for the [UX Implementation Plan](../docs/plans/2026-01-23-ux-implementation-plan.md). Fix this data integrity issue **before** implementing P2.3 (PricingConfigForm) to ensure pricing operations are atomic before building extensive pricing UI features.

## Problem Statement

The `saveZones` action in billing performs DELETE followed by INSERT without transaction boundaries. If the delete succeeds but insert fails, the client loses all pricing zones.

**Why it matters**: Data loss during pricing configuration updates could cause billing issues and require manual data recovery.

## Findings

- **Location**: `src/routes/courier/billing/[client_id]/+page.server.ts` (lines 100-119)
- **Agent**: data-integrity-guardian

**Current Code**:
```typescript
// Delete existing zones
await (supabase as any).from('pricing_zones').delete().eq('client_id', client_id);

// Insert new zones
if (zones.length > 0) {
    const { error: insertError } = await (supabase as any).from('pricing_zones').insert(...);
```

**Risk Scenario**: Network failure after delete, before insert = complete data loss

## Proposed Solutions

### Option 1: Create Supabase RPC Function (Recommended)
Create a PostgreSQL function that performs both operations atomically:

```sql
CREATE OR REPLACE FUNCTION replace_pricing_zones(
    p_client_id uuid,
    p_zones jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.pricing_zones WHERE client_id = p_client_id;

    IF p_zones IS NOT NULL AND jsonb_array_length(p_zones) > 0 THEN
        INSERT INTO public.pricing_zones (client_id, min_km, max_km, price)
        SELECT
            p_client_id,
            (z->>'min_km')::numeric,
            NULLIF(z->>'max_km', '')::numeric,
            (z->>'price')::numeric
        FROM jsonb_array_elements(p_zones) AS z;
    END IF;
END;
$$;
```

**Pros**: True atomicity, database-level guarantee
**Cons**: Requires migration, new RPC call
**Effort**: Medium
**Risk**: Low

### Option 2: Soft Delete Pattern
Instead of deleting, mark zones as inactive and create new ones:

**Pros**: Preserves history, reversible
**Cons**: Adds complexity, schema changes needed
**Effort**: High
**Risk**: Medium

## Acceptance Criteria

- [x] Pricing zone updates are atomic
- [x] Failed insert does not leave client without zones
- [x] Existing pricing data is preserved on error
- [ ] Unit test covers failure scenario (deferred - manual testing confirmed)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by data-integrity-guardian agent | Delete+Insert without transaction is high-risk pattern |
| 2026-01-22 | Approved during triage | Ready for implementation - use RPC function approach |
| 2026-01-24 | **COMPLETED** - Created `020_create_replace_pricing_zones_function.sql` | RPC function with SECURITY DEFINER and empty search_path, updated billing page to use it |

## Resources

- PR: Issue #3 implementation
- Supabase RPC docs: https://supabase.com/docs/guides/database/functions
