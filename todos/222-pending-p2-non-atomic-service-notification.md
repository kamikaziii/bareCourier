---
status: pending
priority: p2
issue_id: "222"
tags: [data-integrity, code-review, notifications, pr-13]
dependencies: []
---

# Non-Atomic Service Update + Notification Dispatch

## Problem Statement

Server actions update services and then send notifications in separate steps without error handling. If the notification fails (network error, edge function timeout), the service is updated but the user is never notified. There's no retry mechanism or failure logging.

**Impact:** Users may not receive important notifications (e.g., delivery confirmation) even though the underlying operation succeeded.

## Findings

**Location:** Multiple server action files

Pattern observed:
```typescript
// Step 1: Update service (committed)
const { error: updateError } = await supabase
  .from('services')
  .update({ status: 'delivered', ... })
  .eq('id', serviceId);

if (updateError) return { success: false };

// Step 2: Send notification (no error handling)
await notifyClient({ ... });  // Fire and forget

return { success: true };  // Returns success even if notification failed
```

**Affected Locations:**
- `src/routes/client/+page.server.ts` - acceptSuggestion, declineSuggestion
- `src/routes/client/new/+page.server.ts` - default action
- `src/routes/courier/services/+page.server.ts` - batchStatusChange
- `src/routes/courier/services/[id]/+page.server.ts` - updateStatus

## Proposed Solutions

### Option A: Log Notification Failures (Minimum)

```typescript
try {
    await notifyClient({ ... });
} catch (error) {
    console.error('Notification failed for service', serviceId, error);
    // Consider storing in notification_failures table for retry
}
return { success: true };
```

**Pros:** Visibility into failures
**Cons:** No automatic retry
**Effort:** Small
**Risk:** Low

### Option B: Return Warning on Notification Failure

```typescript
const notifyResult = await notifyClient({ ... });
if (!notifyResult.success) {
    return {
        success: true,
        warning: 'Service updated but notification failed. Client may need manual contact.'
    };
}
```

**Pros:** User informed of partial failure
**Cons:** Relies on UI displaying warning
**Effort:** Small
**Risk:** Low

### Option C: Database-Triggered Notifications

Move notification logic to database triggers (already exists for some cases):

```sql
CREATE TRIGGER on_service_delivered
AFTER UPDATE ON services
FOR EACH ROW
WHEN (OLD.status != 'delivered' AND NEW.status = 'delivered')
EXECUTE FUNCTION notify_client_delivered();
```

**Pros:** Atomic with service update, consistent
**Cons:** Duplicates edge function logic
**Effort:** Medium
**Risk:** Medium

### Option D: Notification Queue with Retry

```typescript
// Insert into queue (atomic with service update via transaction)
await supabase.from('notification_queue').insert({
    type: 'delivered',
    service_id: serviceId,
    attempts: 0,
    next_retry_at: new Date()
});

// Background worker processes queue with retries
```

**Pros:** Reliable delivery, automatic retry
**Cons:** Infrastructure complexity
**Effort:** Large
**Risk:** Medium

## Technical Details

**Affected Files:**
- `src/routes/client/+page.server.ts`
- `src/routes/client/new/+page.server.ts`
- `src/routes/courier/services/+page.server.ts`
- `src/routes/courier/services/[id]/+page.server.ts`

**Notification Service:**
`notifyClient` in `src/lib/services/notifications.ts` already catches and logs errors (lines 59-61) but returns `{ success: false }` which callers ignore.

## Acceptance Criteria

- [ ] Notification failures are logged with service ID
- [ ] Users are informed when notifications fail (optional)
- [ ] Critical notifications (delivered) have retry mechanism (stretch goal)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #13 code review | Data integrity guardian flagged non-atomic pattern |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
