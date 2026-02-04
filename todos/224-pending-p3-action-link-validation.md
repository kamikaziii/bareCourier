---
status: pending
priority: p3
issue_id: "224"
tags: [code-review, security, defense-in-depth, pr-15]
dependencies: []
---

# P3: action_link Not Validated Before Email Interpolation

## Problem Statement

The `action_link` in invitation emails bypasses HTML escaping and is inserted directly into the email. While currently safe (comes from Supabase's `generateLink()`), URL validation would provide defense-in-depth.

**Why it matters:** If a malicious `action_link` could somehow be injected (e.g., via a compromised internal system), it would be rendered without validation.

## Findings

**Location:** `supabase/functions/send-email/index.ts:78-84, 301`

```typescript
// action_link bypasses escaping
if (key === "app_url" || key === "locale") {
  data[key] = value;
} else {
  data[key] = escapeHtml(value);
}

// Later:
<a href="${data.action_link}" class="button">
```

**Mitigating factors:**
- `action_link` comes from Supabase's trusted `generateLink()` API
- It's passed through internal service-to-service calls

## Proposed Solutions

### Option A: Add URL validation (Recommended)
**Pros:** Defense-in-depth, prevents injection
**Cons:** Minor performance cost
**Effort:** Small
**Risk:** None

```typescript
function isValidActionUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
           (parsed.hostname.endsWith('supabase.co') ||
            parsed.hostname === 'barecourier.vercel.app' ||
            parsed.hostname === 'localhost');
  } catch {
    return false;
  }
}

// In generateEmailHtml:
if (data.action_link && !isValidActionUrl(data.action_link)) {
  throw new Error('Invalid action URL');
}
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `supabase/functions/send-email/index.ts`

## Acceptance Criteria

- [ ] URL validation added for `action_link`
- [ ] Invalid URLs rejected with error
- [ ] Valid invitation links still work

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #15 review | Security agent recommended defense-in-depth |

## Resources

- PR #15: https://github.com/kamikaziii/bareCourier/pull/15
