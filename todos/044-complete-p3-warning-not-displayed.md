# Warning Message Not Displayed to User

---
status: complete
priority: p3
issue_id: "044"
tags: [ux, feedback, pr-4]
dependencies: []
---

**Priority**: P3 (Nice-to-have)
**File**: `src/routes/courier/services/+page.server.ts:97`
**Source**: PR #4 Code Review

## Issue

When a service is created for a client without pricing configuration, the server returns `{ success: true, warning: 'service_created_no_pricing' }`, but the UI doesn't display this warning to the user.

## Server Code

```typescript
if (!pricingConfig) {
  warning = 'service_created_no_pricing';
}
// ...
return { success: true, warning };  // Warning returned but not shown
```

## Client Code

```typescript
return async ({ result }) => {
  if (result.type === 'success' && result.data?.success) {
    // Resets form and reloads - doesn't check warning
    showForm = false;
    // ...
  }
};
```

## Fix

Display a toast or alert when warning is present:

```typescript
if (result.type === 'success' && result.data?.success) {
  if (result.data.warning) {
    // Show toast with warning message
    toast.warning(m[result.data.warning]());
  }
  showForm = false;
  // ...
}
```

## Acceptance Criteria

- [ ] Warning message displayed via toast or alert
- [ ] Uses i18n message key
- [ ] User knows pricing wasn't calculated

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified in PR #4 review | Server warnings should reach the user |
| 2026-01-24 | Approved during triage | Status: ready |
