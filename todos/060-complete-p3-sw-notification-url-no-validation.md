---
status: complete
priority: p3
issue_id: "060"
tags: [service-worker, security, input-validation]
dependencies: []
---

# Notification Click Navigation Has No URL Validation

## Problem Statement

The notification click handler navigates to whatever URL is in the notification data without validating it's safe. A malicious or corrupted push notification could navigate to an external or dangerous URL.

## Findings

**Location:** `src/service-worker.ts:132-148`

**Evidence:**
```typescript
const url = event.notification.data?.url || '/';

// No validation that url is safe
if (client.url.includes(self.location.origin) && 'focus' in client) {
  client.navigate(url);  // Navigate to any URL in data
}
```

**Problem Scenario:**
1. Malicious actor compromises push notification server
2. Sends notification with `url: 'https://evil.com/phishing'`
3. User clicks notification
4. Browser navigates to phishing site

**Risk Level:** Low (requires server compromise), but defense-in-depth is good practice.

## Proposed Solutions

### Option A: Validate URL is same-origin (Recommended)
**Pros:** Prevents external navigation
**Cons:** None
**Effort:** Small
**Risk:** Very Low

```typescript
const url = event.notification.data?.url || '/';

// Validate URL is same-origin
try {
  const parsedUrl = new URL(url, self.location.origin);
  if (parsedUrl.origin !== self.location.origin) {
    console.warn('[SW] Blocked navigation to external URL:', url);
    return;
  }
  client.navigate(parsedUrl.pathname + parsedUrl.search);
} catch {
  console.warn('[SW] Invalid URL in notification:', url);
}
```

## Recommended Action

Option A - Add same-origin validation before navigation.

## Technical Details

**Affected Files:**
- `src/service-worker.ts`

## Acceptance Criteria

- [x] External URLs blocked
- [x] Invalid URLs logged
- [x] Same-origin URLs work correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | Defense in depth for URLs |
| 2026-01-26 | Implemented same-origin URL validation | Used URL parsing to validate and extract only pathname + search |

## Resources

- OWASP Open Redirect
