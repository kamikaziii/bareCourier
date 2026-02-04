---
status: ready
priority: p2
issue_id: "243"
tags: [code-review, architecture, consistency, pr-13]
dependencies: ["240"]
---

# Inconsistent RPC vs Direct Update Patterns

## Problem Statement

The codebase uses two different patterns for updating services: RPC functions (which include validation, history, and atomic transactions) and direct Supabase updates (which bypass these safeguards). This inconsistency can lead to data integrity issues and makes the codebase harder to maintain.

## Findings

**Source:** architecture-strategist agent, data-integrity-guardian agent

**Pattern A - RPC Functions (single actions):**
```typescript
// src/routes/client/+page.server.ts (acceptSuggestion)
const { data: rpcResult } = await supabase.rpc('client_approve_reschedule', {
  p_service_id: serviceId
});
// Includes: validation, history tracking, atomic transaction
```

**Pattern B - Direct Updates (batch actions):**
```typescript
// src/routes/client/+page.server.ts (batchAcceptSuggestions)
const updatePromises = servicesData.map(svc =>
  supabase.from('services').update({
    request_status: 'accepted',
    scheduled_date: svc.suggested_date,
    // Bypasses: validation, history tracking
  }).eq('id', svc.id)
);
```

**Impact:**
- Batch operations bypass RPC validation rules
- No history tracking in batch operations
- Different data outcomes for single vs batch
- Harder to maintain two code paths

## Proposed Solutions

### Solution 1: Always Use RPC (Recommended)
**Pros:** Consistent behavior, single source of truth
**Cons:** Slightly more overhead for batch
**Effort:** Medium
**Risk:** Low

### Solution 2: Create Batch RPC Functions
**Pros:** Best performance, atomic
**Cons:** More migration complexity
**Effort:** Large
**Risk:** Medium

### Solution 3: Extract Shared Validation Logic
**Pros:** Both paths use same rules
**Cons:** Still two code paths
**Effort:** Medium
**Risk:** Medium (duplication risk)

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Files with Direct Updates:**
- `src/routes/client/+page.server.ts` (batch operations)
- `src/routes/courier/requests/+page.server.ts` (batchAccept)

**Existing RPC Functions:**
- `client_approve_reschedule`
- `client_deny_reschedule`
- `reschedule_service`

## Acceptance Criteria

- [ ] All service updates use consistent pattern
- [ ] Batch operations include same validation as single
- [ ] History tracking works for all update types
- [ ] Code is DRY and maintainable

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Mixed patterns create inconsistency |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- Related: #240 (batch operations skip history)
