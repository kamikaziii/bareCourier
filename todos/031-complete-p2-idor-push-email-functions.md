# IDOR Vulnerability in Push/Email Edge Functions

---
status: complete
priority: p2
issue_id: "031"
tags: [security, idor, edge-function]
dependencies: []
---

**Priority**: P2 (Important)
**Files**:
- `supabase/functions/send-push/index.ts:97`
- `supabase/functions/send-email/index.ts:311`
**Source**: security-sentinel code review

## Issue

Any authenticated user can send push notifications or trigger emails to ANY `user_id`. No validation that caller has permission to notify the target user.

## Expected Behavior

- Courier role can notify any user
- Client role can only trigger notifications to themselves or courier

## Fix

1. Add role check at function start:
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

if (profile?.role !== 'courier' && data.user_id !== user.id) {
  return new Response('Forbidden', { status: 403 });
}
```

## Verification

Test as client user attempting to send notification to another client - should return 403.

## Acceptance Criteria

- [x] Clients cannot send notifications to other clients
- [x] Courier can send to anyone
- [x] Returns 403 Forbidden for unauthorized attempts

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by security-sentinel agent | Edge functions need role-based authorization |
| 2026-01-24 | Approved during triage | Status changed to ready |
| 2026-01-24 | Implemented IDOR protection | Added role checks to both send-push and send-email functions. Allows: courier to notify anyone, client to notify self, client to notify courier. Returns 403 for client-to-client notifications. |
