---
status: ready
priority: p2
issue_id: 287
tags: [code-review, pr-18, correctness, sveltekit]
dependencies: []
---

# Bulk assign fetch error handling is broken

## Problem Statement

The `handleAssignAndSwitch` function in PricingTab.svelte uses `response.ok` to check the bulk assign result. SvelteKit form actions return `200 OK` even for `fail()` responses -- the failure is in the JSON body with `type: "failure"`. This means server validation failures (invalid UUID, service type not found) are silently treated as successes, showing a success toast and submitting the pricing mode form.

## Findings

- **All 5 review agents flagged this issue** (security, architecture, performance, patterns, simplicity)
- The codebase has 14 other `fetch("?/...")` call sites that all parse JSON and check `result.type`
- The server action returns `fail(400)` and `fail(404)` but those are never detected client-side
- Missing `try/catch` wrapper (every other fetch call in the codebase has one)
- Missing `invalidateAll()` after success (stale `clientsWithoutServiceType` if pricing mode submit fails)

**Location:** `src/routes/courier/settings/PricingTab.svelte:127-139`

## Proposed Solutions

### Option A: Parse JSON response (Recommended)
Align with the established codebase pattern used in 14 other locations.

```typescript
try {
  const response = await fetch("?/bulkAssignServiceType", {
    method: "POST",
    body: formData,
  });
  const result = await response.json();
  if (result.type === "success" || result.data?.success) {
    toast.success(m.toast_bulk_assign_success({ count: clientsWithoutServiceType.toString() }));
    await invalidateAll();
  } else {
    toast.error(m.toast_bulk_assign_failed(), { duration: 8000 });
    bulkAssigning = false;
    return;
  }
} catch {
  toast.error(m.toast_bulk_assign_failed(), { duration: 8000 });
  bulkAssigning = false;
  return;
}
```

- **Pros:** Consistent with codebase, catches all failure modes
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

### Option B: Use SvelteKit deserialize helper
```typescript
import { deserialize } from '$app/forms';
const result = deserialize(await response.text());
```

- **Pros:** Uses SvelteKit's official API
- **Cons:** Slightly different from existing pattern in codebase
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A -- matches the 14 existing `fetch("?/...")` patterns in the codebase.

## Technical Details

**Affected files:**
- `src/routes/courier/settings/PricingTab.svelte`

**Acceptance Criteria:**
- [ ] Bulk assign failures show error toast (not success)
- [ ] `invalidateAll()` called after successful bulk assign
- [ ] Fetch wrapped in try/catch
- [ ] Response JSON parsed and `result.type` checked

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-13 | Created from PR #18 code review | All 5 agents flagged |

## Resources

- PR #18: fix/zone-detection-and-pricing-safeguards
- Existing pattern: `src/routes/client/+page.svelte` line 217
