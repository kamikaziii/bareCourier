# Parallelize Billing Page Database Queries

---
status: complete
priority: p3
issue_id: "012"
tags: [code-review, performance, optimization]
dependencies: []
resolution: "Already parallelized - billing/[client_id]/+page.server.ts uses Promise.all at line 16. Verified 2026-01-26."
---

## Problem Statement

The billing detail page makes 4 sequential database queries when they could run in parallel.

**Why it matters**: Reduces page load latency by ~75%.

## Findings

- **Location**: `src/routes/courier/billing/[client_id]/+page.server.ts`
- **Agent**: performance-oracle

**Current Code** (sequential):
```typescript
const { data: client } = await supabase.from('profiles')...
const { data: pricing } = await supabase.from('client_pricing')...
const { data: zones } = await supabase.from('pricing_zones')...
const { data: urgencyFees } = await supabase.from('urgency_fees')...
```

**Estimated Latency**: ~400ms (4 x 100ms)

## Proposed Solutions

### Option 1: Promise.all (Recommended)
```typescript
const [clientResult, pricingResult, zonesResult, urgencyFeesResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', client_id).eq('role', 'client').single(),
    supabase.from('client_pricing').select('*').eq('client_id', client_id).single(),
    supabase.from('pricing_zones').select('*').eq('client_id', client_id).order('min_km'),
    supabase.from('urgency_fees').select('*').eq('active', true).order('sort_order')
]);
```

**Expected Latency**: ~100ms
**Effort**: Low
**Risk**: Low

## Acceptance Criteria

- [ ] Queries run in parallel
- [ ] Page load time reduced
- [ ] All data still displays correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by performance-oracle | Sequential await is a common anti-pattern |
| 2026-01-22 | Approved during triage | Ready for implementation - use Promise.all() approach |

## Resources

- SvelteKit Server Load: https://kit.svelte.dev/docs/load
- Promise.all MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
