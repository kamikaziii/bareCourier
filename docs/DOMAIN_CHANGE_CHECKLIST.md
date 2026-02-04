# Domain Change Checklist

When deploying bareCourier to a custom domain (e.g., moving from `barecourier.vercel.app` to `courier.yourbusiness.com`), multiple configuration files contain hardcoded domain references that must be updated.

This document provides a complete checklist of all locations requiring changes.

---

## Table of Contents

1. [Supabase Configuration](#1-supabase-configuration)
2. [Edge Functions CORS](#2-edge-functions-cors)
3. [SvelteKit App URLs](#3-sveltekit-app-urls)
4. [SEO Alternate Links](#4-seo-alternate-links)
5. [Push Notification VAPID Subject](#5-push-notification-vapid-subject)
6. [IndexedDB Store Names (Optional)](#6-indexeddb-store-names-optional)
7. [Package Name (Optional)](#7-package-name-optional)
8. [Recommended Environment Variable Approach](#8-recommended-environment-variable-approach)
9. [Testing Checklist](#9-testing-checklist)
10. [Quick Find and Replace Commands](#10-quick-find-and-replace-commands)

---

## 1. Supabase Configuration

### File: `supabase/config.toml`

**Lines 3-8:**

```toml
site_url = "https://barecourier.vercel.app"
additional_redirect_urls = [
  "https://barecourier.vercel.app/reset-password",
  "https://barecourier.vercel.app/pt-PT/reset-password",
  "http://localhost:5173/reset-password",
  "http://localhost:5173/pt-PT/reset-password"
]
```

**Update to:**

```toml
site_url = "https://your-new-domain.com"
additional_redirect_urls = [
  "https://your-new-domain.com/reset-password",
  "https://your-new-domain.com/pt-PT/reset-password",
  "http://localhost:5173/reset-password",
  "http://localhost:5173/pt-PT/reset-password"
]
```

**Apply changes:**

```bash
supabase config push
```

**Also update in Supabase Dashboard:**
1. Go to Authentication > URL Configuration
2. Update Site URL
3. Add new redirect URLs

---

## 2. Edge Functions CORS

Five edge functions contain hardcoded CORS origin lists. Each needs updating.

### 2.1 `supabase/functions/send-email/index.ts`

**Lines 19-22:**

```typescript
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://barecourier.vercel.app",
];
```

### 2.2 `supabase/functions/send-push/index.ts`

**Lines 21-24:**

```typescript
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://barecourier.vercel.app",
];
```

### 2.3 `supabase/functions/send-notification/index.ts`

**Lines 39-42:**

```typescript
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://barecourier.vercel.app",
];
```

### 2.4 `supabase/functions/create-client/index.ts`

**Lines 17-21:**

```typescript
const isAllowed =
  origin === "https://barecourier.vercel.app" ||
  origin?.startsWith("http://localhost:");
const allowedOrigin = isAllowed ? origin : "https://barecourier.vercel.app";
```

### 2.5 `supabase/functions/reset-client-password/index.ts`

**Lines 12-15:**

```typescript
const isAllowed =
  origin === "https://barecourier.vercel.app" ||
  origin?.startsWith("http://localhost:");
const allowedOrigin = isAllowed ? origin : "https://barecourier.vercel.app";
```

**Redeploy all edge functions:**

```bash
supabase functions deploy send-email
supabase functions deploy send-push
supabase functions deploy send-notification
supabase functions deploy create-client
supabase functions deploy reset-client-password
supabase functions deploy daily-summary
supabase functions deploy check-past-due
```

Or deploy all at once:

```bash
supabase functions deploy --all
```

---

## 3. SvelteKit App URLs

Multiple server-side files contain hardcoded `APP_URL` constants used for email links.

### 3.1 `src/routes/courier/+page.server.ts`

**Line 7:**

```typescript
const APP_URL = 'https://barecourier.vercel.app';
```

### 3.2 `src/routes/courier/services/+page.server.ts`

**Line 8:**

```typescript
const APP_URL = 'https://barecourier.vercel.app';
```

### 3.3 `src/routes/courier/services/[id]/+page.server.ts`

**Line 8:**

```typescript
const APP_URL = 'https://barecourier.vercel.app';
```

### 3.4 `src/routes/courier/requests/+page.server.ts`

**Line 14:**

```typescript
const APP_URL = 'https://barecourier.vercel.app';
```

### 3.5 `src/routes/client/+page.server.ts`

**Line 5:**

```typescript
const APP_URL = 'https://barecourier.vercel.app';
```

### 3.6 `src/routes/client/new/+page.server.ts`

**Line 18:**

```typescript
const APP_URL = 'https://barecourier.vercel.app';
```

---

## 4. SEO Alternate Links

### File: `src/routes/+layout.svelte`

**Lines 52-54:**

```svelte
<link rel="alternate" hreflang="pt-PT" href="https://barecourier.vercel.app{basePathname}" />
<link rel="alternate" hreflang="en" href="https://barecourier.vercel.app/en{basePathname}" />
<link rel="alternate" hreflang="x-default" href="https://barecourier.vercel.app{basePathname}" />
```

**Update to:**

```svelte
<link rel="alternate" hreflang="pt-PT" href="https://your-new-domain.com{basePathname}" />
<link rel="alternate" hreflang="en" href="https://your-new-domain.com/en{basePathname}" />
<link rel="alternate" hreflang="x-default" href="https://your-new-domain.com{basePathname}" />
```

---

## 5. Push Notification VAPID Subject

### File: `supabase/functions/send-push/index.ts`

**Line 57:**

```typescript
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@barecourier.com";
```

**Set environment variable in Supabase:**

```bash
supabase secrets set VAPID_SUBJECT="mailto:admin@your-new-domain.com"
```

Or update the fallback default if not using environment variables.

---

## 6. IndexedDB Store Names (Optional)

### File: `src/lib/services/offline-store.ts`

**Lines 25-27:**

```typescript
const servicesStore: UseStore = createStore('barecourier-services', 'services-cache');
const pendingStore: UseStore = createStore('barecourier-pending', 'pending-mutations');
const conflictsStore: UseStore = createStore('barecourier-conflicts', 'sync-conflicts');
```

These names are local to the user's browser. Changing them is **optional** but will:
- Create new empty IndexedDB stores for existing users
- Orphan old cached data (eventually cleaned up by browser)

**Recommendation:** Only change if rebranding and you want a clean slate.

---

## 7. Package Name (Optional)

### File: `package.json`

**Line 2:**

```json
{
  "name": "barecourier",
  ...
}
```

This is only used for npm package identification and local development. Changing is **optional** unless publishing to npm.

---

## 8. Recommended Environment Variable Approach

Instead of hardcoding URLs, use environment variables for easier multi-environment deployment.

### Step 1: Add to `.env` files

```bash
# .env (local development)
PUBLIC_APP_URL=http://localhost:5173

# .env.production (or Vercel environment variables)
PUBLIC_APP_URL=https://your-new-domain.com
```

### Step 2: Add to Supabase Edge Functions

```bash
supabase secrets set APP_URL="https://your-new-domain.com"
supabase secrets set ALLOWED_ORIGINS="http://localhost:5173,http://localhost:4173,https://your-new-domain.com"
```

### Step 3: Create shared constants file

**Create `src/lib/config.ts`:**

```typescript
import { PUBLIC_APP_URL } from '$env/static/public';

export const APP_URL = PUBLIC_APP_URL || 'https://barecourier.vercel.app';
```

### Step 4: Update Edge Functions to use environment variables

```typescript
// Example for send-email/index.ts
const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS") || "";
const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(",")
  : ["http://localhost:5173", "https://barecourier.vercel.app"];
```

### Step 5: Update SvelteKit files to import from config

```typescript
// Instead of:
const APP_URL = 'https://barecourier.vercel.app';

// Use:
import { APP_URL } from '$lib/config';
```

---

## 9. Testing Checklist

After making domain changes, test these critical flows:

### Authentication Flows

- [ ] **Forgot password flow**
  1. Click "Forgot Password" on login page
  2. Enter email address
  3. Verify email is received with correct domain links
  4. Click reset link - should redirect to new domain
  5. Successfully reset password

- [ ] **Client account creation**
  1. Courier creates new client
  2. Client receives welcome email
  3. Email contains correct domain links
  4. Client can set password via link

### Notification Flows

- [ ] **Email notifications**
  1. Create a new service request
  2. Verify notification email contains correct links
  3. Click links in email - should go to new domain

- [ ] **Push notifications**
  1. Enable push notifications in browser
  2. Trigger a notification (e.g., new service)
  3. Click notification - should open new domain
  4. Check browser console for VAPID errors

### CORS Verification

- [ ] **API calls work from new domain**
  1. Open browser developer tools > Network tab
  2. Perform actions that call edge functions
  3. Verify no CORS errors in console
  4. Check response headers include correct `Access-Control-Allow-Origin`

### PWA Functionality

- [ ] **Service worker**
  1. Load site on mobile device
  2. Check "Add to Home Screen" works
  3. Open PWA from home screen
  4. Verify offline caching works

---

## 10. Quick Find and Replace Commands

### Find all hardcoded domains

```bash
grep -r "barecourier.vercel.app" \
  --include="*.ts" \
  --include="*.svelte" \
  --include="*.toml" \
  --include="*.json" \
  . | grep -v node_modules | grep -v .svelte-kit
```

### Find all APP_URL constants

```bash
grep -rn "APP_URL" \
  --include="*.ts" \
  --include="*.svelte" \
  src/ supabase/
```

### Bulk replace (use with caution)

```bash
# Preview changes first
find . -type f \( -name "*.ts" -o -name "*.svelte" -o -name "*.toml" \) \
  -not -path "./node_modules/*" \
  -not -path "./.svelte-kit/*" \
  -exec grep -l "barecourier.vercel.app" {} \;

# Apply replacement (backup first!)
find . -type f \( -name "*.ts" -o -name "*.svelte" -o -name "*.toml" \) \
  -not -path "./node_modules/*" \
  -not -path "./.svelte-kit/*" \
  -exec sed -i '' 's/barecourier\.vercel\.app/your-new-domain.com/g' {} \;
```

---

## Summary Checklist

| Item | File(s) | Required | Command |
|------|---------|----------|---------|
| Supabase config | `supabase/config.toml` | Yes | `supabase config push` |
| Edge function CORS | 5 files in `supabase/functions/` | Yes | `supabase functions deploy --all` |
| SvelteKit APP_URL | 6 files in `src/routes/` | Yes | Manual edit |
| SEO hreflang links | `src/routes/+layout.svelte` | Yes | Manual edit |
| VAPID subject | Edge function env var | Yes | `supabase secrets set` |
| IndexedDB names | `src/lib/services/offline-store.ts` | No | Manual edit |
| Package name | `package.json` | No | Manual edit |

**Total files to update:** 13 required + 2 optional = 15 files maximum

---

## Related TODOs

- TODO #242: Centralize APP_URL constant (DRY improvement)
- TODO #246: Fix CORS localhost fallback behavior
- TODO #251: Extract shared CORS/auth utilities

Implementing these TODOs will reduce the number of files requiring domain changes in future deployments.
