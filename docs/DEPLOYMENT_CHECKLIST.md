# Deployment Checklist

This document provides checklists for deploying bareCourier to production environments.

## Table of Contents

- [Domain Change Checklist](#domain-change-checklist)
- [Pre-Deployment Verification](#pre-deployment-verification)
- [Post-Deployment Verification](#post-deployment-verification)

---

## Domain Change Checklist

When deploying to a client's custom domain (not `barecourier.vercel.app`), multiple files contain hardcoded domain references that must be updated.

**Impact of not updating:** CORS failures, broken auth redirects, incorrect SEO links.

### 1. Supabase Configuration

**File:** `supabase/config.toml`

```toml
site_url = "https://barecourier.vercel.app"
additional_redirect_urls = [
  "https://barecourier.vercel.app/reset-password",
  "https://barecourier.vercel.app/pt-PT/reset-password",
  ...
]
```

**Action:**
1. Update `site_url` to the new domain
2. Update all `additional_redirect_urls` entries
3. Apply changes:
   ```bash
   supabase config push
   ```

---

### 2. Edge Functions - CORS Origins

Update CORS configuration in the following files:

| File | Lines | Description |
|------|-------|-------------|
| `supabase/functions/reset-client-password/index.ts` | 12-15 | Password reset flow |
| `supabase/functions/create-client/index.ts` | 18-21 | Client creation |
| `supabase/functions/send-notification/index.ts` | 41 | Notifications |
| `supabase/functions/send-push/index.ts` | 23 | Push notifications |
| `supabase/functions/send-email/index.ts` | 21 | Email sending |

**Action:**
1. Update CORS pattern matching or add new domain to allowed list
2. Redeploy all affected functions:
   ```bash
   supabase functions deploy reset-client-password
   supabase functions deploy create-client
   supabase functions deploy send-notification
   supabase functions deploy send-push
   supabase functions deploy send-email
   ```

**Note:** The current CORS pattern `origin.includes("barecourier")` needs updating for non-barecourier domains.

---

### 3. SEO Alternate Links

**File:** `src/routes/+layout.svelte`

```svelte
<link rel="alternate" hreflang="pt-PT" href="https://barecourier.vercel.app{basePathname}" />
<link rel="alternate" hreflang="en" href="https://barecourier.vercel.app/en{basePathname}" />
<link rel="alternate" hreflang="x-default" href="https://barecourier.vercel.app{basePathname}" />
```

**Action:** Update to new domain or make dynamic via environment variable.

---

### 4. VAPID Subject (Push Notifications)

**File:** `supabase/functions/send-push/index.ts`

```typescript
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@barecourier.com";
```

**Action:** Set `VAPID_SUBJECT` environment variable in Supabase Dashboard or update the default fallback.

---

### 5. Optional Updates

These items don't affect functionality but should be updated for consistency:

#### IndexedDB Store Names

**File:** `src/lib/services/offline-store.ts`

```typescript
const servicesStore = createStore('barecourier-services', 'services-cache');
const pendingStore = createStore('barecourier-pending', 'pending-mutations');
const conflictsStore = createStore('barecourier-conflicts', 'sync-conflicts');
```

**Impact:** Client-side only, no functional impact.

#### Package Name

**File:** `package.json`

```json
"name": "barecourier"
```

**Impact:** Development clarity only.

---

### Recommended Approach

#### Option 1: Environment Variables (Recommended for Multi-Tenant)

Create `PUBLIC_APP_DOMAIN` env var and use it everywhere:

| Platform | Configuration |
|----------|---------------|
| Vercel | Set in project settings |
| Supabase | Use for config push |
| Edge functions | Read from `Deno.env.get("APP_DOMAIN")` |

#### Option 2: Find & Replace (Quick One-Time Deployment)

```bash
# Find all occurrences
grep -r "barecourier.vercel.app" --include="*.ts" --include="*.svelte" --include="*.toml"

# Replace (review each file first!)
sed -i '' 's/barecourier\.vercel\.app/newdomain.com/g' <files>
```

---

### Domain Change Verification

After updating all references:

- [ ] All CORS origins updated in edge functions
- [ ] Auth redirect URLs updated in Supabase config
- [ ] SEO links updated in layout
- [ ] Edge functions redeployed
- [ ] **Test:** Forgot password flow works on new domain
- [ ] **Test:** Client creation works on new domain
- [ ] **Test:** Push notifications work on new domain
- [ ] **Test:** Login/logout flow works correctly

---

## Pre-Deployment Verification

Before deploying any changes to production:

### Code Quality

- [ ] `pnpm run check` passes (TypeScript + Svelte)
- [ ] `pnpm run build` completes without errors
- [ ] No console errors in development

### Database

- [ ] All migrations are committed
- [ ] RLS policies are correct: `supabase inspect db lint`
- [ ] Types are up to date in `src/lib/database.types.ts`

### Environment Variables

Verify all required variables are set in Vercel:

- [ ] `PUBLIC_SUPABASE_URL`
- [ ] `PUBLIC_SUPABASE_ANON_KEY`
- [ ] `PUBLIC_MAPBOX_TOKEN`
- [ ] `PUBLIC_OPENROUTE_API_KEY`

---

## Post-Deployment Verification

After deploying to production:

### Authentication

- [ ] Login as courier works
- [ ] Login as client works
- [ ] Forgot password flow works
- [ ] Session persists across page refreshes

### Core Functionality

- [ ] Courier can create services
- [ ] Client can create service requests
- [ ] Services list loads correctly
- [ ] Status updates work (pending -> delivered)

### PWA

- [ ] App installable on mobile
- [ ] Offline mode shows cached data
- [ ] Push notifications work (if enabled)

### Data Isolation

- [ ] Client A cannot see Client B's services
- [ ] Clients cannot access courier routes
- [ ] Courier can see all data

---

## Quick Reference: Files with Domain References

```
supabase/config.toml                              # Auth URLs
supabase/functions/reset-client-password/index.ts # CORS
supabase/functions/create-client/index.ts         # CORS
supabase/functions/send-notification/index.ts     # CORS
supabase/functions/send-push/index.ts             # CORS + VAPID
supabase/functions/send-email/index.ts            # CORS
src/routes/+layout.svelte                         # SEO links
src/lib/services/offline-store.ts                 # IndexedDB (optional)
package.json                                      # Package name (optional)
```
