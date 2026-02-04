---
status: complete
priority: p2
issue_id: "221"
tags: [performance, code-review, notifications, pr-13]
dependencies: []
---

# N+1 HTTP Pattern in Batch Notification Dispatch

## Problem Statement

When marking multiple services as delivered in batch, each service triggers a separate `notifyClient` call, resulting in N HTTP requests to the `send-notification` edge function. For large batches (up to 50 services), this can cause timeouts and poor performance.

**Impact:** Batch operations become slow; potential timeouts at scale; increased edge function costs.

## Findings

**Location:** `src/routes/courier/services/+page.server.ts` lines 99-126

```typescript
// Send notifications in parallel
await Promise.all(
    servicesToNotify.map((service) =>
        notifyClient({
            session,
            clientId: service.client_id,
            serviceId: service.id,
            category: 'service_status',
            title: 'Serviço Entregue',
            message: 'O seu serviço foi marcado como entregue.',
            emailTemplate: 'delivered',
            emailData: {...}
        })
    )
);
```

**Performance Analysis:**
| Batch Size | HTTP Calls | Est. Time |
|------------|------------|-----------|
| 10         | 30-50      | 3-5 sec   |
| 50         | 150-250    | 15-25 sec |

Each `notifyClient` triggers:
1. HTTP to `send-notification`
2. DB query for caller profile
3. DB query for target profile
4. HTTP to `send-push`
5. HTTP to `send-email`

## Proposed Solutions

### Option A: Batch Notification Endpoint (Recommended)

Create a new edge function that accepts multiple notifications:

```typescript
// New: supabase/functions/send-notification-batch/index.ts
await notifyClientsBatch({
    session,
    notifications: servicesToNotify.map(service => ({
        clientId: service.client_id,
        serviceId: service.id,
        emailTemplate: 'delivered',
        emailData: {...}
    }))
});
```

**Pros:** Single HTTP call, can batch DB queries
**Cons:** New endpoint to create and maintain
**Effort:** Medium
**Risk:** Low

### Option B: Chunked Parallel Execution

Process in smaller chunks to avoid overwhelming the system:

```typescript
const CHUNK_SIZE = 5;
for (let i = 0; i < servicesToNotify.length; i += CHUNK_SIZE) {
    const chunk = servicesToNotify.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(service => notifyClient({...})));
}
```

**Pros:** Simple, limits concurrent connections
**Cons:** Still N HTTP calls, just throttled
**Effort:** Small
**Risk:** Low

### Option C: Fire-and-Forget with Background Job

Queue notifications for background processing:

```typescript
await supabase.from('notification_queue').insert(
    servicesToNotify.map(service => ({
        client_id: service.client_id,
        service_id: service.id,
        template: 'delivered'
    }))
);
// Background worker processes queue
```

**Pros:** Non-blocking, resilient to failures
**Cons:** More infrastructure, delayed delivery
**Effort:** Large
**Risk:** Medium

## Technical Details

**Affected Files:**
- `src/routes/courier/services/+page.server.ts`
- If Option A: New `supabase/functions/send-notification-batch/index.ts`

**Current Limit:**
`MAX_BATCH_SIZE = 50` (defined at line 39)

## Acceptance Criteria

- [x] Batch status change completes within 10 seconds for 50 services
- [x] No timeout errors for maximum batch size
- [x] All clients receive notifications (no dropped messages)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #13 code review | Performance oracle identified scaling issue |
| 2026-02-04 | Implemented Option B (chunked parallel) | Fixed in `src/routes/courier/+page.server.ts` and `src/routes/courier/requests/+page.server.ts` with NOTIFICATION_CHUNK_SIZE=5 |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
