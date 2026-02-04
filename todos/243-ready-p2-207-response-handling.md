---
status: ready
priority: p2
issue_id: "243"
tags: [code-review, pr-15, ux]
dependencies: []
---

# Frontend 207 Partial Success Handling

## Problem Statement

The frontend code does not properly handle HTTP 207 (Multi-Status) responses, causing partial failures to fall through the success path without warning the user.

## Findings

**Location:** `src/routes/courier/clients/new/+page.svelte:130-136`

**Issue:** The current response handling checks for `response.ok` which includes 207 status:

```typescript
if (response.ok) {
  // Treats 207 as full success
  goto('/courier/clients');
}
```

HTTP 207 indicates partial success - for example, the client was created but the invitation email failed to send. Users should be informed of this partial failure.

## Proposed Solution

Explicitly check for 207 status and display appropriate feedback:

```typescript
if (response.status === 207) {
  const result = await response.json();
  // Show warning toast about partial success
  toast.warning('Client created, but there was an issue: ' + result.warning);
  goto('/courier/clients');
} else if (response.ok) {
  toast.success('Client created and invitation sent!');
  goto('/courier/clients');
}
```

## Acceptance Criteria

- [ ] Check for HTTP 207 status separately from other success codes
- [ ] Display warning message when 207 is received
- [ ] Parse and show the specific warning from response body
- [ ] Still navigate to clients list after 207 (client was created)
- [ ] Test with simulated email failure scenario

## Work Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-02-04 | Created | Code review finding from PR #15 |
