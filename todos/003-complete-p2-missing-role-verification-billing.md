# Missing Courier Role Verification in Billing Actions

---
status: ready
priority: p2
issue_id: "003"
tags: [code-review, security, authorization]
dependencies: []
---

## Problem Statement

The billing configuration actions (`savePricing`, `saveZones`) only check for session existence, not courier role.

**Why it matters**: Same defense-in-depth reasoning as issue #002.

## Findings

- **Location**: `src/routes/courier/billing/[client_id]/+page.server.ts`
- **Lines**: 56-86, 88-122
- **Agent**: security-sentinel

**Current Code**:
```typescript
savePricing: async ({ params, request, locals: { supabase, safeGetSession } }) => {
    const { session, user } = await safeGetSession();
    if (!session || !user) {
        return { success: false, error: 'Not authenticated' };
    }
    // Missing: role verification
```

## Proposed Solutions

Same as issue #002 - add role verification check.

**Effort**: Low (15 minutes)
**Risk**: Low

## Acceptance Criteria

- [ ] `savePricing` action verifies courier role
- [ ] `saveZones` action verifies courier role
- [ ] Non-courier users receive 403 Unauthorized response

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by security-sentinel agent | Related to #002 |
| 2026-01-22 | Approved during triage | Ready for implementation - same fix as #002 |
