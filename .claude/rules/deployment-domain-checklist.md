# Deployment Domain Change Checklist

## Overview

When deploying bareCourier to a custom domain (not `barecourier.vercel.app`), multiple files contain hardcoded domain references that must be updated.

**Impact if not updated:**
- CORS failures on edge function calls
- Broken authentication redirects (password reset, email verification)
- Incorrect SEO alternate links (search engines index wrong URLs)
- Push notification VAPID subject mismatch

---

## Checklist of Locations to Update

### 1. Supabase Configuration

**File:** `supabase/config.toml`

| Line | Field | Current Value |
|------|-------|---------------|
| 3 | `site_url` | `https://barecourier.vercel.app` |
| 5-8 | `additional_redirect_urls` | Multiple `barecourier.vercel.app` URLs |

**What to update:**
```toml
[auth]
site_url = "https://yourcustomdomain.com"
additional_redirect_urls = [
  "https://yourcustomdomain.com/reset-password",
  "https://yourcustomdomain.com/pt-PT/reset-password",
  "http://localhost:5173/reset-password",
  "http://localhost:5173/pt-PT/reset-password"
]
```

---

### 2. Edge Functions - CORS Origins

These files contain hardcoded CORS origin checks. All must be updated with the new domain.

| File | Lines | Pattern |
|------|-------|---------|
| `supabase/functions/reset-client-password/index.ts` | 12-15, 21 | `barecourier.vercel.app` in `getCorsHeaders()` |
| `supabase/functions/create-client/index.ts` | 18-19, 21 | `barecourier.vercel.app` in `getCorsHeaders()` |
| `supabase/functions/send-notification/index.ts` | 41 | `allowedOrigins` array |
| `supabase/functions/send-push/index.ts` | 23 | `allowedOrigins` array |
| `supabase/functions/send-email/index.ts` | 21 | `allowedOrigins` array |

**Pattern A (getCorsHeaders style):**
```typescript
// Lines 12-15 and 21 in reset-client-password/index.ts
const isAllowed =
  origin.startsWith("http://localhost:") ||
  origin === "https://yourcustomdomain.com" ||
  (origin.endsWith(".vercel.app") && origin.includes("yourcustomdomain"));

const allowedOrigin = isAllowed ? origin : "https://yourcustomdomain.com";
```

**Pattern B (allowedOrigins array style):**
```typescript
// send-notification, send-push, send-email
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://yourcustomdomain.com",
];
```

---

### 3. SEO Alternate Links

**File:** `src/routes/+layout.svelte`

| Lines | Element | Current Value |
|-------|---------|---------------|
| 53-57 | `<link rel="alternate" hreflang="pt-PT">` | `https://barecourier.vercel.app{basePathname}` |
| 58-62 | `<link rel="alternate" hreflang="en">` | `https://barecourier.vercel.app/en{basePathname}` |
| 63-67 | `<link rel="alternate" hreflang="x-default">` | `https://barecourier.vercel.app{basePathname}` |

**What to update:**
```svelte
<link rel="alternate" hreflang="pt-PT" href="https://yourcustomdomain.com{basePathname}" />
<link rel="alternate" hreflang="en" href="https://yourcustomdomain.com/en{basePathname}" />
<link rel="alternate" hreflang="x-default" href="https://yourcustomdomain.com{basePathname}" />
```

---

### 4. VAPID Subject (Push Notifications)

**File:** `supabase/functions/send-push/index.ts`

| Line | Variable | Current Value |
|------|----------|---------------|
| 57 | `vapidSubject` | `mailto:admin@barecourier.com` |

**What to update:**
Either set the `VAPID_SUBJECT` environment variable in Supabase Dashboard, or update the fallback:
```typescript
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@yourcustomdomain.com";
```

---

### 5. IndexedDB Store Names (Optional)

**File:** `src/lib/services/offline-store.ts`

| Lines | Store Name |
|-------|------------|
| 25 | `barecourier-services` |
| 26 | `barecourier-pending` |
| 27 | `barecourier-conflicts` |

**Note:** These are client-side only and do not affect functionality. Updating is optional for branding consistency.

---

### 6. Package Name (Optional)

**File:** `package.json`

| Field | Current Value |
|-------|---------------|
| `name` | `barecourier` |

**Note:** Optional update for clarity if deploying under a different brand.

---

## Commands to Apply Changes

### After updating Supabase config:
```bash
supabase config push
```

### After updating edge functions:
```bash
supabase functions deploy reset-client-password
supabase functions deploy create-client
supabase functions deploy send-notification
supabase functions deploy send-push
supabase functions deploy send-email
```

### Set VAPID_SUBJECT environment variable:
In Supabase Dashboard > Project Settings > Edge Functions > Secrets:
```
VAPID_SUBJECT=mailto:admin@yourcustomdomain.com
```

---

## Testing Checklist

After deployment to the new domain, verify:

- [ ] **Forgot password flow works**
  1. Go to `/login` on new domain
  2. Click "Forgot password"
  3. Enter email and submit
  4. Check email arrives with correct reset link (new domain)
  5. Click reset link and verify it loads correctly
  6. Reset password successfully

- [ ] **Client creation works**
  1. Log in as courier
  2. Navigate to Clients > New
  3. Fill form and submit
  4. Verify client is created without CORS errors
  5. Verify welcome email contains correct links

- [ ] **Push notifications work**
  1. Enable push notifications in browser
  2. Create a new service as client
  3. Verify courier receives push notification
  4. Click notification and verify it opens correct URL

- [ ] **SEO alternate links**
  1. View page source on new domain
  2. Verify hreflang links point to new domain
  3. Test with Google Search Console URL inspection (if available)

---

## Recommended: Environment Variable Approach

For easier future domain changes, consider refactoring to use environment variables:

### Vercel (Frontend)

In Vercel Dashboard > Project Settings > Environment Variables:
```
PUBLIC_APP_DOMAIN=yourcustomdomain.com
```

Update `+layout.svelte`:
```svelte
<script>
  import { PUBLIC_APP_DOMAIN } from '$env/static/public';
  const domain = PUBLIC_APP_DOMAIN || 'barecourier.vercel.app';
</script>

<link rel="alternate" hreflang="pt-PT" href="https://{domain}{basePathname}" />
```

### Supabase (Edge Functions)

In Supabase Dashboard > Edge Functions > Secrets:
```
APP_DOMAIN=yourcustomdomain.com
```

Update edge functions:
```typescript
const appDomain = Deno.env.get("APP_DOMAIN") || "barecourier.vercel.app";
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  `https://${appDomain}`,
];
```

---

## Quick Find and Replace

To find all occurrences of the current domain:
```bash
grep -r "barecourier.vercel.app" --include="*.ts" --include="*.svelte" --include="*.toml" .
grep -r "barecourier.com" --include="*.ts" .
```

**Warning:** Use find and replace carefully. Some occurrences may need different handling (e.g., the VAPID subject is an email address, not a URL).

---

## Summary

| Priority | Location | File Count | Impact if Missed |
|----------|----------|------------|------------------|
| Critical | Supabase config.toml | 1 | Auth redirects fail |
| Critical | Edge function CORS | 5 | All edge function calls fail |
| High | SEO hreflang links | 1 | Wrong URLs indexed |
| Medium | VAPID subject | 1 | Push notifications may fail |
| Low | IndexedDB names | 1 | None (cosmetic) |
| Low | Package name | 1 | None (cosmetic) |
