---
status: ready
priority: p3
issue_id: "223"
tags: [code-review, debugging, error-handling, pr-15]
dependencies: []
---

# P3: Silent Error Handling in Client Status Check

## Problem Statement

The catch block in `checkClientStatus()` silently fails without logging, making debugging difficult in production.

**Why it matters:** When the status check fails, there's no way to diagnose why from logs.

## Findings

**Location:** `src/routes/courier/clients/[id]/+page.svelte:103-106`

```typescript
} catch {
  // Silently fail - just don't show the resend button
}
checkingStatus = false;
```

## Proposed Solutions

### Option A: Add debug logging (Recommended)
**Pros:** Aids debugging, minimal impact
**Cons:** None
**Effort:** Tiny
**Risk:** None

```typescript
} catch (err) {
  // Status check failure is non-critical - button simply won't show
  console.debug('Failed to check client invitation status:', err);
}
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `src/routes/courier/clients/[id]/+page.svelte`

## Acceptance Criteria

- [ ] Error logged with debug level
- [ ] No user-facing change

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #15 review | Pattern agent flagged silent catch |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
