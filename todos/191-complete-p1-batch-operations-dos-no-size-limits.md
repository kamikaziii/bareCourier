---
status: pending
priority: p1
issue_id: "191"
tags: [security, dos, performance, code-review]
dependencies: []
---

# CRITICAL: Mass Assignment DoS Vulnerability in Batch Operations

## Problem Statement

Batch operations (reschedule, accept, status change) process arrays without size limits, enabling denial-of-service attacks by exhausting database connection pools and server memory.

**Why it matters:** An attacker can submit 10,000+ service IDs, spawning thousands of concurrent database queries that exhaust resources and cause application-wide downtime for legitimate users.

## Findings

**Affected Files:**
- `src/routes/client/+page.server.ts` (Lines 175-188, 256-266)
- `src/routes/courier/+page.server.ts` (Lines 77-86)

**Vulnerable pattern:**
```typescript
// No validation on serviceIds.length
serviceIds = JSON.parse(formData.get('service_ids') as string);
const updatePromises = servicesData.map(svc =>
  supabase.from('services').update(...).eq('id', svc.id)
);
await Promise.all(updatePromises);  // Spawns N concurrent queries
```

**Attack scenario:**
1. Attacker submits 10,000+ service IDs
2. Server spawns 10,000 concurrent database queries
3. Database connection pool exhausted (default: 25 connections)
4. Legitimate users experience timeout errors
5. Application becomes unresponsive

**Impact:**
- Application-wide denial of service
- Database connection pool exhaustion
- Memory exhaustion in Node.js process
- Potential cascade to other services

**Source:** Security Sentinel review of PR #8

## Proposed Solutions

### Solution 1: Add Hard Batch Size Limit (RECOMMENDED)
**Pros:**
- Simple to implement
- Prevents resource exhaustion
- Predictable behavior

**Cons:**
- May require UI updates to chunk large selections

**Effort:** Small (30 minutes)

**Risk:** Low - Standard DoS protection

**Implementation:**
```typescript
const MAX_BATCH_SIZE = 50;

let serviceIds: string[];
try {
  const raw = formData.get('service_ids') as string;
  serviceIds = JSON.parse(raw);

  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    return { success: false, error: 'Invalid service selection' };
  }

  if (serviceIds.length > MAX_BATCH_SIZE) {
    return {
      success: false,
      error: `Maximum ${MAX_BATCH_SIZE} services per batch. Please select fewer services.`
    };
  }
} catch {
  return { success: false, error: 'Invalid service selection format' };
}
```

### Solution 2: Chunked Processing with Concurrency Limit
**Pros:**
- Handles large batches gracefully
- Prevents connection pool exhaustion
- Better user experience for large selections

**Cons:**
- More complex implementation
- Longer processing time for large batches

**Effort:** Medium (2 hours)

**Risk:** Low - Standard batching pattern

**Implementation:**
```typescript
const MAX_BATCH_SIZE = 200;  // Total limit
const CHUNK_SIZE = 10;       // Concurrent queries

if (serviceIds.length > MAX_BATCH_SIZE) {
  return { success: false, error: `Maximum ${MAX_BATCH_SIZE} services allowed` };
}

// Process in chunks
const chunks = [];
for (let i = 0; i < serviceIds.length; i += CHUNK_SIZE) {
  chunks.push(serviceIds.slice(i, i + CHUNK_SIZE));
}

let totalUpdated = 0;
for (const chunk of chunks) {
  const results = await Promise.all(
    chunk.map(id => supabase.from('services').update(...).eq('id', id))
  );
  totalUpdated += results.filter(r => !r.error).length;
}

return { success: true, updated: totalUpdated };
```

### Solution 3: Rate Limiting Per User
**Pros:**
- Prevents abuse across multiple requests
- Complements batch size limits

**Cons:**
- Requires Redis or similar state store
- More infrastructure complexity

**Effort:** Large (4 hours)

**Risk:** Medium - New infrastructure dependency

## Recommended Action

**⚠️ CRITICAL: This fix REQUIRES UI updates before deployment to prevent user frustration.**

Deploy **Solution 1** (hard limit) WITH corresponding UI changes:
1. Update `use-batch-selection` composable to cap at MAX_BATCH_SIZE
2. Show warning when user tries to select >50 items
3. Disable submit button when selection exceeds limit

Without UI updates, this fix will cause poor UX (users select 100 items, server rejects, must manually deselect).

## Technical Details

**Affected Components:**
- Client batch operations (accept suggestions, decline suggestions, cancel requests)
- Courier batch operations (reschedule services, accept requests, change status)

**Database Impact:**
- Connection pool: Default 25 connections
- Current risk: Unlimited concurrent queries
- After fix: Max 50 queries per batch (controlled)

**UI Impact (VERIFIED):**
- `courier/+page.svelte:48` - `batch.selectAll(sortedServices.filter(...))` can select unlimited
- `courier/requests/+page.svelte:42` - `batch.selectAll(data.pendingRequests.map(...))` can select unlimited
- **Breakage scenario:** User with 150 services clicks "Select All" → all 150 selected → submit → server rejects → user must manually deselect 100 items

**Required UI Updates:**
1. Update `lib/composables/use-batch-selection.svelte.ts` to cap at MAX_BATCH_SIZE
2. Show warning toast when capping selections
3. Add validation message when selection > MAX_BATCH_SIZE
4. Disable submit button if selection exceeds limit

## Acceptance Criteria

- [ ] All batch operations validate array size before processing
- [ ] Maximum batch size documented (50 services recommended)
- [ ] Error message clearly states limit when exceeded
- [ ] Test with 100+ service IDs to verify rejection
- [ ] Monitor database connection pool usage in production
- [ ] Add metrics for batch operation sizes

## Work Log

### 2026-01-30
- **Discovery:** Security Sentinel identified unlimited array processing
- **Impact Analysis:** Confirmed DoS risk with connection pool exhaustion
- **Priority:** P1 (critical) - blocks PR merge

## Resources

- **Related PR:** #8 (feat/navigation-performance-fixes)
- **CWE Reference:** [CWE-770: Allocation of Resources Without Limits](https://cwe.mitre.org/data/definitions/770.html)
- **OWASP:** A04:2021 - Insecure Design
- **Supabase Docs:** [Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooling)
