---
status: pending
priority: p2
issue_id: "194"
tags: [error-handling, notifications, observability, code-review]
dependencies: []
---

# Silent Notification Failures - No Error Propagation

## Problem Statement

The notification service (`lib/services/notifications.ts`) swallows all errors with `console.error`, preventing callers from knowing if notifications failed. This means database operations succeed but users never receive critical notifications, with no visibility or retry mechanism.

**Why it matters:** Users rely on notifications for time-sensitive updates (schedule changes, request approvals). Silent failures mean clients show up at wrong times, miss pickups, or don't know their requests were processed.

## Findings

**File:** `src/lib/services/notifications.ts` (Lines 50-56, 100-105)

**Problem code:**
```typescript
if (!response.ok) {
  console.error('Notification failed:', response.status, await response.text());
}
// No return value - caller has NO IDEA if notification failed!
```

**Impact scenario:**
1. Edge Function is down during deployment
2. Courier accepts 10 service requests
3. All database updates succeed ✅
4. All 10 email notifications fail ❌
5. Clients never receive acceptance notifications
6. Courier thinks everything worked fine
7. Clients show up at wrong time/date

**Current behavior:**
- `notifyClient()` returns `Promise<void>` - no success/failure indicator
- Errors only appear in server logs (which may not be monitored)
- No retry mechanism for failed notifications
- No user-facing warning that notifications failed

**Source:** Data Integrity Guardian + Architecture Strategist reviews of PR #8

## Proposed Solutions

### Solution 1: Return Result Object with Retry Logic (RECOMMENDED)
**Pros:**
- Callers can detect failures
- Automatic retry for transient errors
- User feedback for permanent failures
- Production-ready error handling

**Cons:**
- Breaking change to notification service API
- Requires updating all callers

**Effort:** Medium (2 hours)

**Risk:** Low - Improves reliability

**Implementation:**
```typescript
export type NotificationResult =
  | { success: true }
  | { success: false; error: string; retryable: boolean };

export async function notifyClient(params: {
  session: { access_token: string };
  clientId: string;
  serviceId: string;
  category: string;
  title: string;
  message: string;
}): Promise<NotificationResult> {
  const maxRetries = 3;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: PUBLIC_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          user_id: clientId,
          category,
          title,
          message,
          service_id: serviceId
        })
      });

      if (response.ok) {
        return { success: true };
      }

      lastError = `HTTP ${response.status}: ${await response.text()}`;

      // Don't retry 4xx errors (client errors are permanent)
      if (response.status >= 400 && response.status < 500) {
        return { success: false, error: lastError, retryable: false };
      }

      // Exponential backoff for 5xx errors
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    } catch (error) {
      lastError = String(error);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  console.error('Notification failed after retries:', lastError);
  return { success: false, error: lastError!, retryable: true };
}

// In action handlers, check notification results:
const notificationResult = await notifyClient({...});
if (!notificationResult.success) {
  // Log to database for later retry or show warning to user
  await supabase.from('failed_notifications').insert({
    client_id: service.client_id,
    service_id: serviceId,
    error: notificationResult.error,
    retryable: notificationResult.retryable,
    created_at: new Date().toISOString()
  });

  if (notificationResult.retryable) {
    // Show warning: "Service updated, but notification may be delayed"
  }
}
```

### Solution 2: Background Job Queue
**Pros:**
- Decouples notification from request
- Built-in retry and monitoring
- Scalable for high volume

**Cons:**
- Requires additional infrastructure (queue service)
- More complex architecture
- Delayed notifications

**Effort:** Large (8 hours)

**Risk:** Medium - New infrastructure dependency

**Implementation:**
Use Supabase Edge Functions with queue (e.g., pg_cron + database table as queue).

## Recommended Action

**Solution 1** - Return result objects with retry logic. This provides immediate improvement without infrastructure changes and makes failures visible to the application layer.

## Technical Details

**Affected Components:**
- `src/lib/services/notifications.ts` (service layer)
- All callers in `courier/+page.server.ts`, `courier/requests/+page.server.ts`, `client/+page.server.ts`

**Database Schema Addition:**
```sql
CREATE TABLE failed_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id),
  service_id uuid REFERENCES services(id),
  error text NOT NULL,
  retryable boolean DEFAULT true,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  last_retry_at timestamptz,
  resolved_at timestamptz
);

CREATE INDEX idx_failed_notifications_retryable
ON failed_notifications(created_at)
WHERE retryable = true AND resolved_at IS NULL;
```

**Retry Worker (Future Enhancement):**
```typescript
// Edge function that runs every 5 minutes
// Retries failed notifications with exponential backoff
```

## Acceptance Criteria

- [ ] `notifyClient()` and `notifyCourier()` return `NotificationResult` type
- [ ] Transient errors (5xx) automatically retry 3 times with exponential backoff
- [ ] Permanent errors (4xx) don't retry and are logged
- [ ] Failed notifications stored in database for visibility
- [ ] Action handlers show warning to user when notifications fail
- [ ] Metrics track notification success rate
- [ ] Documentation updated with error handling examples

## Work Log

### 2026-01-30
- **Discovery:** Data Integrity Guardian identified silent failures during PR #8 review
- **Impact:** Confirmed critical notifications can fail without visibility
- **Priority:** P2 (important) - Should fix before production

## Resources

- **Related PR:** #8 (feat/navigation-performance-fixes)
- **File:** `src/lib/services/notifications.ts`
- **Callers:** 18 locations across courier/client routes
- **Pattern:** Retry with exponential backoff (standard practice)
