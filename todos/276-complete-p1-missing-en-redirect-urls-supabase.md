---
status: ready
priority: p1
issue_id: "276"
tags: [bug, auth, i18n, config]
dependencies: []
---

# Missing /en/ Redirect URLs in Supabase Config

## Problem Statement
`supabase/config.toml:4-12` lists `/reset-password` and `/pt-PT/reset-password` but not `/en/reset-password`. Paraglide's `localizeHref` adds `/{locale}/` prefix for non-base locales. Base locale is `pt-PT`, so English users get `/en/reset-password` which Supabase rejects. Same issue for `/en/accept-invite`.

## Findings
- Location: `supabase/config.toml:4-12`
- Paraglide runtime: `runtime.js:818-824` — base locale gets no prefix, others get `/{locale}/`
- `project.inlang/settings.json:3` — baseLocale is `pt-PT`
- `forgot-password/+page.svelte:23` uses `localizeHref("/reset-password")`
- Impact: English-locale users cannot reset passwords

## Proposed Solutions

### Option 1: Add /en/ variants to redirect whitelist
- Add `https://barecourier.vercel.app/en/reset-password`
- Add `https://barecourier.vercel.app/en/accept-invite`
- Add localhost equivalents
- **Pros**: Simple config change
- **Cons**: None
- **Effort**: Small (10 minutes)
- **Risk**: Low

## Recommended Action
Add all missing `/en/` redirect URL variants to `config.toml`.

## Technical Details
- **Affected Files**: `supabase/config.toml`
- **Related Components**: Password reset, client invitation
- **Database Changes**: No (config push needed: `supabase db push`)

## Acceptance Criteria
- [ ] English-locale users can reset password successfully
- [ ] English-locale users can accept invitation successfully
- [ ] Portuguese-locale flows still work

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06
