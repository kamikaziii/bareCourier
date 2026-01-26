---
status: ready
priority: p1
issue_id: "053"
tags: [service-worker, security, error-handling]
dependencies: []
---

# JSON.parse Without Try-Catch in Push Handler

## Problem Statement

The push notification handler in the service worker lacks try-catch wrapping around `event.data.json()`. If the server sends malformed JSON, the service worker crashes silently with no notification shown and no error logged.

## Findings

**Location:** `src/service-worker.ts:109`

**Evidence:**
```typescript
const data = event.data.json();  // Can throw SyntaxError - NO try-catch
```

**Problem Scenario:**
1. Server sends malformed push payload (e.g., `{"invalid json}`)
2. `event.data.json()` throws SyntaxError
3. Service worker thread crashes
4. No notification displayed to user
5. No error logged anywhere
6. Silent failure

## Proposed Solutions

### Option A: Wrap in try-catch (Recommended)
**Pros:** Simple, handles errors gracefully
**Cons:** None
**Effort:** Small
**Risk:** Very Low

```typescript
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch (error) {
        console.error('[SW] Failed to parse push notification:', error);
        return;
    }
    // ... rest of handler
});
```

## Recommended Action

Add try-catch around JSON.parse with console.error logging.

## Technical Details

**Affected Files:**
- `src/service-worker.ts`

## Acceptance Criteria

- [ ] JSON.parse wrapped in try-catch
- [ ] Error logged to console on parse failure
- [ ] Service worker continues running after malformed push

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during service worker audit | External input should always be validated |

## Resources

- OWASP Input Validation
