---
status: ready
priority: p2
issue_id: "161"
tags: [performance, batch-operations, notifications]
dependencies: []
---

# Parallelize Notification Sends in Batch Reschedule

## Problem Statement
Notifications are sent sequentially in batch reschedule operations. With 5 different clients, this adds 1-2.5 seconds of latency. Notifications can be sent in parallel with `Promise.all()` for immediate performance win.

## Findings
- Location: `src/routes/courier/+page.server.ts:130-144` (batchReschedule action)
- Current: `for` loop with sequential `await notifyClient()` calls
- Impact: Each notification ~200-500ms, with 5 clients = 1-2.5s delay
- Fix: Use `Promise.all()` to parallelize

## Proposed Solutions

### Option 1: Parallelize with Promise.all() (Recommended)
- **Pros**: ~5-10x faster notification delivery, trivial change
- **Cons**: None
- **Effort**: Small (5 minutes)
- **Risk**: Low (fire-and-forget notifications, logging handles errors)

## Recommended Action
Replace the sequential loop with `Promise.all()`:

```typescript
// Before: Sequential
for (const [clientId, serviceIdList] of clientNotifications) {
  await notifyClient(session, clientId, serviceIdList[0], ...);
}

// After: Parallel
await Promise.all(
  Array.from(clientNotifications).map(([clientId, serviceIdList]) =>
    notifyClient(session, clientId, serviceIdList[0], ...)
  )
);
```

## Technical Details
- **Affected Files**: `src/routes/courier/+page.server.ts`
- **Related Components**: Batch reschedule action, notification system
- **Database Changes**: No
- **Notifications Still**: All sent, just in parallel now

## Resources
- Original finding: Performance audit
- Related issues: #154 (duplicated notification helpers)

## Acceptance Criteria
- [ ] Sequential loop replaced with `Promise.all()`
- [ ] All notifications still sent to correct clients
- [ ] No errors in notification delivery
- [ ] Response time reduced by ~80%
- [ ] Code review approved

## Work Log

### 2026-01-28 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

## Notes
Source: Triage session on 2026-01-28
