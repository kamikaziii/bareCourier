---
status: ready
priority: p2
issue_id: "215"
tags: [infrastructure, deployment, checklist]
dependencies: []
---

# Domain Change Checklist - All Hardcoded URLs

## Problem Statement

When deploying to a client's custom domain (not `barecourier.vercel.app`), multiple files contain hardcoded domain references that must be updated.

**Impact:** CORS failures, broken auth redirects, incorrect SEO links if not updated.

## Locations to Update

### 1. Supabase Config (`supabase/config.toml`)
```toml
site_url = "https://barecourier.vercel.app"
additional_redirect_urls = [
  "https://barecourier.vercel.app/reset-password",
  "https://barecourier.vercel.app/pt-PT/reset-password",
  ...
]
```
**Action:** Update `site_url` and all `additional_redirect_urls`, then run `supabase config push`

---

### 2. Edge Functions - CORS (5 files)

| File | Lines |
|------|-------|
| `supabase/functions/reset-client-password/index.ts` | 12-15 |
| `supabase/functions/create-client/index.ts` | 18-21 |
| `supabase/functions/send-notification/index.ts` | 41 |
| `supabase/functions/send-push/index.ts` | 23 |
| `supabase/functions/send-email/index.ts` | 21 |

**Action:** Update CORS pattern matching or add new domain to allowed list. Then redeploy:
```bash
supabase functions deploy reset-client-password
supabase functions deploy create-client
supabase functions deploy send-notification
supabase functions deploy send-push
supabase functions deploy send-email
```

---

### 3. SEO Alternate Links (`src/routes/+layout.svelte`)
```svelte
<link rel="alternate" hreflang="pt-PT" href="https://barecourier.vercel.app{basePathname}" />
<link rel="alternate" hreflang="en" href="https://barecourier.vercel.app/en{basePathname}" />
<link rel="alternate" hreflang="x-default" href="https://barecourier.vercel.app{basePathname}" />
```
**Action:** Update to new domain or make dynamic via environment variable

---

### 4. VAPID Subject (`supabase/functions/send-push/index.ts`)
```typescript
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@barecourier.com";
```
**Action:** Set `VAPID_SUBJECT` env var in Supabase Dashboard or update default

---

### 5. IndexedDB Store Names (`src/lib/services/offline-store.ts`)
```typescript
const servicesStore = createStore('barecourier-services', 'services-cache');
const pendingStore = createStore('barecourier-pending', 'pending-mutations');
const conflictsStore = createStore('barecourier-conflicts', 'sync-conflicts');
```
**Action:** Optional - these are client-side only and don't affect functionality

---

### 6. Package Name (`package.json`)
```json
"name": "barecourier"
```
**Action:** Optional - update for clarity

---

## Recommended Approach

### Option 1: Environment Variables (Recommended)

Create `PUBLIC_APP_DOMAIN` env var and use it everywhere:
- Vercel: Set in project settings
- Supabase: Use for config push
- Edge functions: Read from `Deno.env.get("APP_DOMAIN")`

### Option 2: Find & Replace

When deploying to new domain:
```bash
# Find all occurrences
grep -r "barecourier.vercel.app" --include="*.ts" --include="*.svelte" --include="*.toml"

# Replace (careful!)
sed -i '' 's/barecourier\.vercel\.app/newdomain.com/g' <files>
```

## Acceptance Criteria

- [ ] All CORS origins updated
- [ ] Auth redirect URLs updated in Supabase
- [ ] SEO links updated
- [ ] Edge functions redeployed
- [ ] Test: Forgot password flow works on new domain
- [ ] Test: Client creation works on new domain
- [ ] Test: Push notifications work on new domain

## Notes

- Consider refactoring to use environment variables before client deployment
- The CORS pattern `origin.includes("barecourier")` in edge functions needs updating for non-barecourier domains
