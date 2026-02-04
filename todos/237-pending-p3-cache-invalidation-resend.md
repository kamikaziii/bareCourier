---
status: pending
priority: p3
issue_id: "237"
tags: [code-review, pr-15, cache]
dependencies: []
---

# Cache Not Invalidated After Resend

## Problem Statement

When a courier resends an invitation from the client detail page, the `clientStatusCache` is not cleared after a successful resend operation. This means the cached status data may become stale, potentially showing outdated invitation status until the cache TTL expires or the page is refreshed.

## Findings

**Location:** `src/routes/courier/clients/[id]/+page.svelte`

The `handleResendInvitation` function successfully resends the invitation but does not invalidate the cached client status:

```typescript
async function handleResendInvitation() {
  // ... resend logic ...
  if (response.ok) {
    // Success handling - cache NOT cleared here
    invitationStatus = 'pending';
    // Missing: clientStatusCache.delete(data.profile.id);
  }
}
```

The cache entry for this client will retain the old invitation timestamp and status until it naturally expires (5 minutes TTL).

## Proposed Solution

Add cache invalidation in the success path of `handleResendInvitation`:

```typescript
if (response.ok) {
  // Clear cached status since invitation was just resent
  clientStatusCache.delete(data.profile.id);
  
  invitationStatus = 'pending';
  invitedAt = new Date().toISOString();
  // ... rest of success handling
}
```

## Acceptance Criteria

- [ ] After successful resend, the client's entry is removed from `clientStatusCache`
- [ ] Subsequent loads fetch fresh status from the API
- [ ] No regression in invitation resend functionality

## Work Log

| Date | Action | Details |
|------|--------|---------|
| 2026-02-04 | Created | PR #15 code review finding |
