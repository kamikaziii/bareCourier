---
status: pending
priority: p2
issue_id: "241"
tags: [code-review, pr-15, security]
dependencies: []
---

# CORS Validation Subdomain Spoofing

## Problem Statement

The CORS origin validation in the edge function uses a loose string matching pattern that could allow malicious subdomains to bypass security controls.

## Findings

**Location:** `supabase/functions/_shared/cors.ts:17-20`

**Issue:** The pattern `origin.includes("barecourier")` is too permissive and allows malicious subdomains like:
- `https://barecourier.malicious-site.com`
- `https://evil-barecourier.vercel.app`
- `https://barecourier-phishing.attacker.com`

An attacker could register a domain containing "barecourier" and make cross-origin requests to the edge functions.

## Proposed Solution

Replace the loose `includes()` check with a stricter regex pattern:

```typescript
// Instead of:
if (origin.includes("barecourier")) {
  return origin;
}

// Use:
const vercelPattern = /^https:\/\/barecourier(-[a-z0-9]+)?\.vercel\.app$/;
if (vercelPattern.test(origin)) {
  return origin;
}
```

This ensures only legitimate Vercel preview deployments and the production domain are allowed.

## Acceptance Criteria

- [ ] CORS validation uses regex pattern instead of `includes()`
- [ ] Pattern matches production domain: `https://barecourier.vercel.app`
- [ ] Pattern matches preview deployments: `https://barecourier-abc123.vercel.app`
- [ ] Pattern rejects malicious domains containing "barecourier"
- [ ] Edge functions tested with valid and invalid origins

## Work Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-02-04 | Created | Code review finding from PR #15 |
