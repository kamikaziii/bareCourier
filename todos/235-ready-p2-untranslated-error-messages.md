---
status: ready
priority: p2
issue_id: "235"
tags: [code-review, i18n, pr-16]
dependencies: []
---

# Untranslated Error Messages in Toast Calls

## Problem Statement

Some routes display raw server error strings without translation, breaking i18n for Portuguese users.

**Why it matters:** Portuguese users will see English error messages, inconsistent with the app's i18n support.

## Findings

**Source:** Architecture Strategist Agent

**Locations:**
- `src/routes/client/new/+page.svelte:244` - `result.data.error` displayed directly
- `src/routes/courier/services/new/+page.svelte:160` - `result.data.error` displayed directly

**Problem:** Server-side error messages are shown without translation mapping.

## Proposed Solutions

### Option A: Map Server Errors to i18n Keys (Recommended)

Backend returns error codes, frontend maps to localized messages:

```typescript
// Server-side
if (error) {
  return fail(400, { error: 'client_inactive_error' });  // key, not message
}

// Client-side
const errorKey = result.data.error as keyof typeof m;
toast.error(m[errorKey]?.() ?? m.generic_error());
```

**Pros:** Proper i18n, maintainable
**Cons:** Requires backend changes
**Effort:** Medium
**Risk:** Low

### Option B: Use Generic Error Messages
Always show generic localized error, ignore server message.

**Pros:** Quick fix
**Cons:** Less helpful for users
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- Fill after triage -->

## Technical Details

**Affected files:**
- `src/routes/client/new/+page.svelte`
- `src/routes/courier/services/new/+page.svelte`
- `messages/en.json` (may need new keys)
- `messages/pt-PT.json` (may need new keys)

## Acceptance Criteria

- [ ] All error messages displayed via toast are localized
- [ ] Test: Switch language to PT-PT, trigger error, verify Portuguese message

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #16 code review | Architecture agent found i18n gaps |

## Resources

- PR #16: feat: implement toast notification system
- Related: #232 (security concerns with error messages)
