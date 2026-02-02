---
status: pending
priority: p2
issue_id: "212"
tags: [infrastructure, auth, code-review]
dependencies: []
---

# Configure Supabase Redirect URL for Password Reset

## Problem Statement

The password reset flow requires `/reset-password` to be added to Supabase's allowed redirect URLs. Without this configuration, clicking the password reset link in emails will fail with "Redirect URL is not allowed".

**Impact:** Password reset emails will not work until this is configured in Supabase Dashboard.

## Findings

- **Location:** Supabase Dashboard → Auth → URL Configuration → Redirect URLs
- **Current state:** `/reset-password` likely not configured
- **Email links:** Use `redirectTo` parameter that Supabase validates against allowlist

**Code evidence (from forgot-password page):**
```svelte
await data.supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}${localizeHref("/reset-password")}`,
});
```

## Proposed Solutions

### Option 1: Add Production URL (Required)

**Approach:** Add `https://barecourier.vercel.app/reset-password` to Supabase redirect URLs.

**Steps:**
1. Go to Supabase Dashboard
2. Navigate to Auth → URL Configuration
3. Add to Redirect URLs: `https://barecourier.vercel.app/reset-password`
4. (Optional) Add `https://barecourier.vercel.app/pt-PT/reset-password` for Portuguese locale
5. Save

**Pros:**
- Simple configuration
- Required for feature to work

**Cons:**
- Manual step, not in code

**Effort:** 5 minutes

**Risk:** None

---

### Option 2: Add Wildcard for All Paths

**Approach:** Add `https://barecourier.vercel.app/**` to allow all paths.

**Pros:**
- Covers future redirect needs

**Cons:**
- Slightly less secure
- Supabase may not support wildcards

**Effort:** 5 minutes

**Risk:** Low

## Recommended Action

_To be filled during triage._

## Technical Details

**Configuration location:**
- Supabase Dashboard → Auth → URL Configuration → Redirect URLs

**URLs to add:**
- `https://barecourier.vercel.app/reset-password`
- `https://barecourier.vercel.app/pt-PT/reset-password` (for i18n)
- `http://localhost:5173/reset-password` (for dev)
- `http://localhost:5173/pt-PT/reset-password` (for dev)

## Resources

- **Supabase Docs:** [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- **Related:** Forgot password implementation

## Acceptance Criteria

- [ ] Production redirect URL configured in Supabase
- [ ] Localhost redirect URL configured for development
- [ ] Portuguese locale paths configured
- [ ] Test: Click reset link in email → lands on reset page
- [ ] Test: Reset link from localhost dev → works

## Work Log

### 2026-02-02 - Code Review Discovery

**By:** Claude Code

**Actions:**
- Identified that Supabase redirect URL configuration is a manual step
- Noted that forgot-password page uses redirectTo parameter
- Documented required URLs for configuration

**Learnings:**
- Supabase validates redirectTo against an allowlist
- Locale-prefixed paths need separate entries

## Notes

- This is a manual configuration step, not a code change
- Should be done before testing password reset flow in production
- Consider documenting this in README or deployment checklist
