---
title: "Vercel Paraglide JS Reroute Hook Returns 404 for Localized Routes"
category: deployment-issues
tags: [vercel, i18n, paraglide, sveltekit, reroute, 404]
symptoms:
  - Localized routes like /en/courier return 404 in production
  - Works locally but fails on Vercel deployment
  - English routes fail while Portuguese (default) works
root_cause: SvelteKit reroute hook incompatibility with Vercel multi-function deployment
severity: critical
affected_components:
  - src/hooks.ts
  - Vercel serverless functions
date_documented: 2025-01-21
status: known-issue-with-workaround
related_issues:
  - https://github.com/sveltejs/kit/issues/11879
  - https://github.com/sveltejs/kit/pull/12296
  - https://github.com/opral/inlang-paraglide-js/issues/32
---

# Vercel Paraglide JS Reroute Hook Returns 404 for Localized Routes

## Problem Description

When deploying a SvelteKit app with Paraglide JS i18n to Vercel, localized routes (e.g., `/en/courier`, `/en/client`) may return **404 errors** in production, even though they work correctly in local development.

### Symptoms

- `/courier` (Portuguese/default) works correctly
- `/en/courier` (English) returns 404
- All English-prefixed routes fail
- Local development with `pnpm run dev` works perfectly
- Local production build with `pnpm run preview` works perfectly
- Only fails when deployed to Vercel

### Affected Configuration

```typescript
// src/hooks.ts - This file causes the issue on Vercel
import type { Reroute } from '@sveltejs/kit';
import { deLocalizeUrl } from '$lib/paraglide/runtime.js';

export const reroute: Reroute = (request) => {
  return deLocalizeUrl(request.url).pathname;
};
```

## Root Cause

The SvelteKit `reroute` hook has a known incompatibility with Vercel deployments when the app is split across multiple serverless functions ([GitHub Issue #11879](https://github.com/sveltejs/kit/issues/11879)).

### Technical Details

1. Vercel may deploy SvelteKit apps as **multiple serverless functions** (either due to app size or `split: true` config)
2. The `reroute` hook runs **after** Vercel's routing decision determines which function handles the request
3. This means `/en/courier` gets routed to a function that doesn't know about the `/en` prefix
4. Result: 404 error because the function can't find the route

### When This Occurs

- App is large enough that Vercel splits it into multiple functions
- Using `split: true` in `@sveltejs/adapter-vercel` configuration
- Vercel automatically decides to split due to function size limits

### When This Does NOT Occur

- App is small enough to fit in a single function (most likely for bareCourier)
- Using edge runtime (different deployment model)

## Investigation Steps

### 1. Check if issue affects your deployment

```bash
# Deploy to Vercel
vercel deploy

# Test localized routes
curl -I https://your-app.vercel.app/en/courier
curl -I https://your-app.vercel.app/en/client
```

If you get 404s for `/en/*` routes but 200s for non-prefixed routes, this issue affects you.

### 2. Check Vercel function configuration

In Vercel dashboard:
- Go to your project → Settings → Functions
- Check if multiple functions are listed
- If only one function exists, the reroute hook should work

## Solution: Alternative Architecture (If Affected)

If the reroute hook fails on Vercel, implement the **locale folder structure** approach:

### Step 1: Remove the reroute hook

```bash
# Delete or comment out src/hooks.ts
rm src/hooks.ts
```

### Step 2: Create locale parameter route structure

Restructure routes to use `[[locale]]` optional parameter:

```
src/routes/
├── [[locale]]/
│   ├── +layout.svelte
│   ├── +layout.server.ts
│   ├── +page.svelte
│   ├── login/
│   │   └── +page.svelte
│   ├── courier/
│   │   ├── +layout.svelte
│   │   ├── +layout.server.ts
│   │   ├── +page.svelte
│   │   ├── services/
│   │   ├── clients/
│   │   └── reports/
│   └── client/
│       ├── +layout.svelte
│       ├── +layout.server.ts
│       ├── +page.svelte
│       └── new/
└── +layout.svelte (root - imports CSS, minimal)
```

### Step 3: Update layout to handle locale parameter

```svelte
<!-- src/routes/[[locale]]/+layout.server.ts -->
<script lang="ts">
  import type { LayoutServerLoad } from './$types';
  import { locales, baseLocale } from '$lib/paraglide/runtime.js';
  import { redirect } from '@sveltejs/kit';

  export const load: LayoutServerLoad = async ({ params }) => {
    const locale = params.locale;

    // Validate locale parameter
    if (locale && !locales.includes(locale)) {
      // Invalid locale, redirect to base
      redirect(307, `/${baseLocale}`);
    }

    return {
      locale: locale || baseLocale
    };
  };
</script>
```

### Step 4: Update vite.config.ts

Remove `urlPatterns` since routing is now handled by folder structure:

```typescript
paraglideVitePlugin({
  project: './project.inlang',
  outdir: './src/lib/paraglide',
  strategy: ['url', 'cookie', 'baseLocale']
  // Remove urlPatterns - folder structure handles this now
})
```

### Step 5: Update hooks.server.ts

Modify the paraglide middleware to not use URL-based locale detection:

```typescript
// src/hooks.server.ts
const i18nHandle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
    event.request = localizedRequest;
    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html
          .replace('%paraglide.lang%', locale)
          .replace('%paraglide.dir%', 'ltr')
    });
  });
```

## Prevention Strategies

### 1. Test Vercel deployment early

Always test i18n routes on Vercel staging before going to production:

```bash
# Deploy to preview
vercel

# Test all locale variants
curl -I https://preview-url.vercel.app/
curl -I https://preview-url.vercel.app/en/
curl -I https://preview-url.vercel.app/courier
curl -I https://preview-url.vercel.app/en/courier
```

### 2. Monitor the upstream fix

PR [#12296](https://github.com/sveltejs/kit/pull/12296) will fix this by generating edge middleware for the reroute hook. Once merged:

```bash
# Update SvelteKit adapter
pnpm update @sveltejs/adapter-vercel
```

### 3. Keep app size small

If the app stays under Vercel's function size limit, it deploys as a single function and the reroute hook works fine.

## Current Status (as of 2025-01-21)

| Item | Status |
|------|--------|
| GitHub Issue #11879 | Open |
| Fix PR #12296 | Open (not merged) |
| bareCourier deployment | Not yet tested on Vercel |
| Recommended action | Deploy and test `/en/*` routes |

## Related Documentation

- [Paraglide SvelteKit Deployment Guide](https://inlang.com/m/dxnzrydw/paraglide-sveltekit-i18n/deployment)
- [SvelteKit Vercel Adapter Docs](https://svelte.dev/docs/kit/adapter-vercel)
- [Paraglide JS Server-Side Rendering](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/server-side-rendering)

## Quick Reference

### Check if affected
```bash
curl -I https://your-app.vercel.app/en/courier
# 404 = affected, 200 = working
```

### Quick fix (if affected)
1. Delete `src/hooks.ts`
2. Move routes to `src/routes/[[locale]]/`
3. Redeploy

### Monitor for permanent fix
Watch [PR #12296](https://github.com/sveltejs/kit/pull/12296) for merge status.
