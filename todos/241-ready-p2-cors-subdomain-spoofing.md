---
status: ready
priority: p2
issue_id: "241"
tags: [code-review, pr-15, security]
dependencies: []
---

# CORS Validation Subdomain Spoofing

## Problem Statement

The CORS origin validation in the edge function uses a pattern that could allow malicious Vercel deployments to bypass security controls.

## Findings

**Location:** `supabase/functions/_shared/cors.ts:17-20`

**Actual code:**
```typescript
const isAllowed =
  origin.startsWith("http://localhost:") ||
  origin === "https://barecourier.vercel.app" ||
  (origin.endsWith(".vercel.app") && origin.includes("barecourier"));
```

**Issue:** While the check requires `.vercel.app` suffix (blocking arbitrary domains), it still allows:
- `https://evil-barecourier.vercel.app` ✓ (ends with .vercel.app AND includes barecourier)
- `https://barecourier-phishing.vercel.app` ✓ (same pattern)

**Note:** This does NOT allow `https://barecourier.malicious-site.com` (doesn't end with .vercel.app).

An attacker could deploy a malicious Vercel app with "barecourier" in the subdomain to make cross-origin requests.

## Proposed Solution

Replace the loose pattern with a stricter regex that only allows the exact project name:

```typescript
// Instead of:
(origin.endsWith(".vercel.app") && origin.includes("barecourier"))

// Use a regex that matches only barecourier preview deployments:
const vercelPattern = /^https:\/\/barecourier(-[a-z0-9]+)?\.vercel\.app$/;
const isAllowed =
  origin.startsWith("http://localhost:") ||
  origin === "https://barecourier.vercel.app" ||
  vercelPattern.test(origin);
```

This ensures only legitimate Vercel preview deployments (`barecourier-abc123.vercel.app`) are allowed, not arbitrary subdomains containing "barecourier".

## Acceptance Criteria

- [ ] CORS validation uses regex pattern instead of `includes()`
- [ ] Pattern matches production domain: `https://barecourier.vercel.app`
- [ ] Pattern matches preview deployments: `https://barecourier-abc123.vercel.app`
- [ ] Pattern rejects malicious Vercel deployments containing "barecourier"
- [ ] Edge functions tested with valid and invalid origins

## Work Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-02-04 | Created | Code review finding from PR #15 |
