---
status: complete
priority: p1
issue_id: "217"
tags: [bug, code-review, notifications, email, pr-13]
dependencies: []
---

# Missing or Wrong app_url in Email Data Causes Broken Links

## Problem Statement

Several email templates include links like `<a href="${data.app_url}/courier/services/${data.service_id}">` but the `app_url` field is either:
1. **Missing entirely** from `emailData` objects in server actions
2. **Using wrong value** (`PUBLIC_SUPABASE_URL` instead of the app URL)

This results in emails with broken links showing `undefined/courier/services/...` or pointing to `https://xxx.supabase.co/...` instead of the actual app.

**Impact:** Users receive emails with non-functional buttons/links, degrading trust and usability.

## Findings

### Issue 1: Missing app_url

**Location:** `src/routes/client/+page.server.ts`

Missing `app_url` in these locations:

1. **acceptSuggestion** (lines 81-87):
```typescript
emailData: {
    client_name: service.profiles?.name || 'Cliente',
    pickup_location: service.pickup_location,
    delivery_location: service.delivery_location,
    new_date: formattedNewDate,
    service_id: serviceId
    // Missing: app_url
}
```

2. **declineSuggestion** (lines 163-170) - same issue

3. **batchAcceptSuggestions** (lines 272-278, 300-306) - same issue

4. **batchDeclineSuggestions** (lines 400-407, 421-428) - same issue

### Issue 2: Wrong app_url Value

**Location:** `src/routes/client/+page.server.ts` line 500

```typescript
// cancelRequest action - WRONG VALUE
app_url: PUBLIC_SUPABASE_URL.replace('/functions/v1', '')
```

`PUBLIC_SUPABASE_URL` is `https://xxx.supabase.co`, NOT the app URL. The `.replace('/functions/v1', '')` has no effect because that substring isn't in the URL.

### Correct Pattern (in edge functions)

The edge functions use the correct pattern:
```typescript
// supabase/functions/check-past-due/index.ts line 268
app_url: Deno.env.get('APP_URL') || 'https://barecourier.vercel.app'
```

**Email template that expects app_url:**
```typescript
// supabase/functions/send-email/index.ts line 369
<a href="${data.app_url}/courier/services/${data.service_id}" class="button">
```

## Proposed Solutions

### Option A: Add app_url to Each emailData (Quick Fix)

```typescript
// Add to .env
PUBLIC_APP_URL=https://barecourier.vercel.app

// In server actions
import { PUBLIC_APP_URL } from '$env/static/public';

emailData: {
    client_name: service.profiles?.name || 'Cliente',
    pickup_location: service.pickup_location,
    delivery_location: service.delivery_location,
    new_date: formattedNewDate,
    service_id: serviceId,
    app_url: PUBLIC_APP_URL || 'https://barecourier.vercel.app'
}
```

**Pros:** Simple fix, explicit
**Cons:** Repeated in every location
**Effort:** Small
**Risk:** Low

### Option B: Add app_url in notifyCourier/notifyClient Helpers (Recommended)

Modify `src/lib/services/notifications.ts` to automatically inject `app_url`:

```typescript
import { PUBLIC_APP_URL } from '$env/static/public';

const DEFAULT_APP_URL = 'https://barecourier.vercel.app';

export async function notifyCourier(params: {...}) {
  const emailDataWithUrl = params.emailData ? {
    ...params.emailData,
    app_url: params.emailData.app_url || PUBLIC_APP_URL || DEFAULT_APP_URL
  } : undefined;
  // ... rest of function using emailDataWithUrl
}
```

**Pros:** DRY, single source of truth, prevents future omissions
**Cons:** Implicit behavior
**Effort:** Small
**Risk:** Low

## Technical Details

**Affected Files:**
- `src/routes/client/+page.server.ts` (5 locations - 4 missing, 1 wrong)
- `src/lib/services/notifications.ts` (for Option B)

**Environment Variable Needed:**
- `PUBLIC_APP_URL` in `.env` and Vercel environment settings

**Locations to Fix:**
1. `acceptSuggestion` - add app_url
2. `declineSuggestion` - add app_url
3. `batchAcceptSuggestions` (2 places) - add app_url
4. `batchDeclineSuggestions` (2 places) - add app_url
5. `cancelRequest` - fix wrong value

## Acceptance Criteria

- [ ] All emailData objects include correct `app_url`
- [ ] `PUBLIC_APP_URL` environment variable added to Vercel
- [ ] Test email for suggestion_accepted contains working link to app
- [ ] Test email for suggestion_declined contains working link to app
- [ ] Test email for request_cancelled contains working link to app
- [ ] Links work in both development and production environments

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #13 code review | Pattern recognition specialist found the gap |
| 2026-02-04 | Added Issue 2: cancelRequest uses wrong URL | Verification found PUBLIC_SUPABASE_URL used instead of app URL |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
