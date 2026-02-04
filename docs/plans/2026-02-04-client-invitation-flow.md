# ✨ feat: Client Invitation Email Flow

**Date**: 2026-02-04
**Branch**: `feature/client-invitation-flow`
**Status**: ✅ Implementation Complete - Ready for Testing

---

## Implementation Decisions (2026-02-04)

Clarifications resolved during implementation:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Profile creation | Trigger handles it | `handle_new_user` trigger fires on `auth.users` INSERT, creates profile with `role='client'` and `name` from metadata. Works for both `createUser` and `generateLink`. |
| Resend approach | Single endpoint | `create-client` detects existing unconfirmed users and resends invitation. Simpler than separate endpoint. |
| Confirmation check | Edge function | New `check-client-status` endpoint uses admin API to check `auth.users.email_confirmed_at`. Avoids schema changes. |
| Success UX | Toast + redirect to list | After invitation sent, show toast "Invitation sent to {email}" and redirect to `/courier/clients`. |

---

## Overview

Add email invitation capability to client creation, allowing clients to set their own passwords securely.

**Current State**: Courier enters email + password → client receives credentials verbally
**Target State**: Courier can choose between:
- **Invitation flow** (recommended): Email + name → client receives email → sets own password
- **Password flow** (fallback): Email + password → existing behavior for testing/urgent cases

---

## Problem Statement / Motivation

### Security Concerns
- Courier knows client passwords (bad practice)
- No audit trail of password delivery
- Client cannot change password without courier involvement

### UX Issues
- Awkward credential handoff (verbal, written note, SMS?)
- No clear onboarding experience for new clients

### Business Value
- Professional onboarding experience
- Self-service password management
- Fallback option retained for flexibility

---

## Proposed Solution

Modify the existing `create-client` edge function to support both flows via a toggle:

### UI Behavior
- **Toggle ON** (default): "Send invitation email"
  - Password field hidden
  - Uses `generateLink({ type: 'invite' })`
  - Sends branded email via Resend
- **Toggle OFF**: "Set password manually"
  - Password field shown
  - Uses existing `createUser({ password })` flow

### Architecture Diagram

```
┌─────────────────┐      ┌──────────────────┐
│  Courier UI     │      │  create-client   │
│  (toggle form)  │─────▶│  Edge Function   │
└─────────────────┘      └──────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
           [send_invitation=true]      [send_invitation=false]
                    │                           │
                    ▼                           ▼
           ┌──────────────────┐       ┌──────────────────┐
           │  generateLink()  │       │  createUser()    │
           │  + send email    │       │  (existing flow) │
           └──────────────────┘       └──────────────────┘
                    │
                    ▼
           ┌──────────────────┐      ┌─────────────────┐
           │  Client Email    │─────▶│  /accept-invite │
           │  (click link)    │      │  (set password) │
           └──────────────────┘      └─────────────────┘
```

---

## Technical Approach

### Phase 1: Modify Edge Function

**File**: `supabase/functions/create-client/index.ts`

Add invitation mode to existing function:

```typescript
const { email, password, name, phone, send_invitation, ...rest } = await req.json();

if (send_invitation) {
  // Invitation flow: generate link + send email
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${SITE_URL}/accept-invite`,
      data: {
        role: 'client',
        name: name || '',
        phone: phone || null,
        invited_by: courierId
      }
    }
  });

  if (linkError) {
    return errorResponse(linkError.message, 400);
  }

  // Fetch courier name for personalized email
  const { data: courierProfile } = await adminClient
    .from('profiles')
    .select('name')
    .eq('id', courierId)
    .single();

  // Send invitation email via existing send-email infrastructure
  const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: linkData.user.id,
      template: 'client_invitation',
      data: {
        action_link: linkData.properties.action_link,
        client_name: name,
        courier_name: courierProfile?.name || 'Your courier',
        app_url: SITE_URL
      }
    })
  });

  if (!emailResponse.ok) {
    // Email failed - return 500, courier can retry
    return errorResponse('Failed to send invitation email', 500);
  }

  return successResponse({
    user: { id: linkData.user.id, email },
    invitation_sent: true
  });

} else {
  // Password flow: existing createUser logic (unchanged)
  if (!password) {
    return errorResponse('Password required when not sending invitation', 400);
  }
  // ... existing createUser code ...
}
```

**Key changes:**
- Add `send_invitation` boolean parameter
- Branch logic based on invitation vs password flow
- Fetch courier profile for personalized email
- Use retry pattern for profile race condition (existing code)
- Return 500 if email fails (simple error handling)

### Phase 2: Email Template

**File**: `supabase/functions/send-email/index.ts`

Add `client_invitation` template:

```typescript
case "client_invitation":
  return {
    subject: emailT("email_invitation_subject", locale, { courier_name: data.courier_name }),
    html: `
      <!DOCTYPE html>
      <html>
      <head>${baseStyles}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${emailT("email_invitation_title", locale)}</h1>
          </div>
          <div class="content">
            <p>${emailT("email_invitation_intro", locale, {
              client_name: data.client_name,
              courier_name: data.courier_name
            })}</p>
            <p>${emailT("email_invitation_instructions", locale)}</p>
            <a href="${data.action_link}" class="button">
              ${emailT("email_invitation_button", locale)}
            </a>
            <p class="small">${emailT("email_invitation_expiry", locale)}</p>
          </div>
          <div class="footer">
            <p>${emailT("email_invitation_help", locale)}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
```

**File**: `supabase/functions/_shared/email-translations.ts`

Add translation keys:

```typescript
// English
email_invitation_subject: "{courier_name} invited you to bareCourier",
email_invitation_title: "Welcome to bareCourier!",
email_invitation_intro: "Hi {client_name}, you've been invited by {courier_name} to create your client account.",
email_invitation_instructions: "Click the button below to set your password and complete your registration:",
email_invitation_button: "Set Your Password",
email_invitation_expiry: "This link expires in 24 hours.",
email_invitation_help: "Need help? Contact your courier directly.",

// Portuguese
email_invitation_subject: "{courier_name} convidou-o para o bareCourier",
email_invitation_title: "Bem-vindo ao bareCourier!",
email_invitation_intro: "Olá {client_name}, foi convidado por {courier_name} para criar a sua conta de cliente.",
email_invitation_instructions: "Clique no botão abaixo para definir a sua palavra-passe e concluir o registo:",
email_invitation_button: "Definir Palavra-passe",
email_invitation_expiry: "Este link expira em 24 horas.",
email_invitation_help: "Precisa de ajuda? Contacte o seu estafeta diretamente.",
```

### Phase 3: Accept Invite Page

**Files**:
- `src/routes/accept-invite/+page.svelte`
- `src/routes/accept-invite/+page.ts`

Pattern based on `/reset-password` but simpler (invite auto-signs user in):

```svelte
<!-- src/routes/accept-invite/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';
  import * as m from '$lib/paraglide/messages.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';

  let { data }: { data: PageData } = $props();

  let password = $state('');
  let confirmPassword = $state('');
  let loading = $state(false);
  let error = $state('');
  let sessionReady = $state(false);
  let authError = $state('');

  // Listen for auth state change (invite link auto-signs in)
  $effect(() => {
    const { data: { subscription } } = data.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        sessionReady = true;
      }
      if (event === 'TOKEN_REFRESHED' && session) {
        sessionReady = true;
      }
    });

    // Check if already signed in
    data.supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) sessionReady = true;
    });

    return () => subscription.unsubscribe();
  });

  // Check URL for error params (expired/invalid token)
  $effect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error_description') || params.get('error');
    if (errorParam) {
      authError = errorParam.includes('expired')
        ? m.invitation_expired()
        : m.invitation_invalid();
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';

    if (password.length < 6) {
      error = m.password_min_length();
      return;
    }

    if (password !== confirmPassword) {
      error = m.passwords_do_not_match();
      return;
    }

    loading = true;

    const { error: updateError } = await data.supabase.auth.updateUser({
      password
    });

    if (updateError) {
      error = updateError.message;
      loading = false;
      return;
    }

    // Success - redirect to client dashboard (stay logged in)
    goto('/client', { replaceState: true });
  }
</script>

{#if authError}
  <div class="text-center space-y-4">
    <h1 class="text-2xl font-bold">{m.invitation_error_title()}</h1>
    <p class="text-muted-foreground">{authError}</p>
    <p>{m.invitation_contact_courier()}</p>
  </div>
{:else if !sessionReady}
  <div class="text-center">
    <p>{m.verifying_invitation()}</p>
  </div>
{:else}
  <form onsubmit={handleSubmit} class="space-y-4 max-w-md mx-auto">
    <h1 class="text-2xl font-bold text-center">{m.set_your_password()}</h1>

    {#if error}
      <div class="text-destructive text-sm">{error}</div>
    {/if}

    <div class="space-y-2">
      <Label for="password">{m.password()}</Label>
      <Input
        id="password"
        type="password"
        bind:value={password}
        minlength={6}
        required
      />
      <p class="text-xs text-muted-foreground">{m.password_hint()}</p>
    </div>

    <div class="space-y-2">
      <Label for="confirm">{m.confirm_password()}</Label>
      <Input
        id="confirm"
        type="password"
        bind:value={confirmPassword}
        required
      />
    </div>

    <Button type="submit" class="w-full" disabled={loading}>
      {loading ? m.saving() : m.set_password_button()}
    </Button>
  </form>
{/if}
```

```typescript
// src/routes/accept-invite/+page.ts
export const load = async () => {
  // Page is public - no auth guard needed
  // Session will be created when user clicks invite link
  return {};
};
```

### Phase 4: UI Updates

**File**: `src/routes/courier/clients/new/+page.svelte`

Add toggle and conditional password field:

```svelte
<script lang="ts">
  // ... existing imports ...
  import { Switch } from '$lib/components/ui/switch/index.js';

  // ... existing state ...
  let sendInvitation = $state(true); // Default to invitation flow
</script>

<!-- In form -->
<div class="flex items-center justify-between">
  <Label for="send-invitation">{m.send_invitation_email()}</Label>
  <Switch id="send-invitation" bind:checked={sendInvitation} />
</div>

{#if !sendInvitation}
  <div class="space-y-2">
    <Label for="password">{m.password()}</Label>
    <Input
      id="password"
      type="password"
      bind:value={password}
      minlength={6}
      required
    />
  </div>
{/if}

<!-- Update submit handler -->
<script>
  async function handleSubmit() {
    // ...
    const response = await fetch(`${supabaseUrl}/functions/v1/create-client`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        name,
        phone,
        send_invitation: sendInvitation,
        password: sendInvitation ? undefined : password,
        // ... other fields
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.invitation_sent) {
        // Show success: "Invitation sent to {email}"
      } else {
        // Show success: "Client created"
      }
    }
  }
</script>
```

**File**: `src/routes/courier/clients/[id]/+page.svelte`

Add "Resend Invitation" button for unconfirmed clients:

```svelte
<!-- In client detail page, show if email not confirmed -->
{#if !client.email_confirmed_at}
  <Button variant="outline" onclick={resendInvitation}>
    {m.resend_invitation()}
  </Button>
{/if}

<script>
  async function resendInvitation() {
    // Call create-client with send_invitation=true for existing user
    // Edge function will detect existing unconfirmed user and resend
  }
</script>
```

### Phase 5: Handle Existing Unconfirmed Users (Resend Flow)

**Update**: `supabase/functions/create-client/index.ts`

Add logic to handle resend for existing unconfirmed users:

```typescript
if (send_invitation) {
  // Check if user already exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === email);

  if (existingUser) {
    if (existingUser.email_confirmed_at) {
      // User already confirmed - can't resend invite
      return errorResponse('This email is already registered', 400);
    }

    // User exists but unconfirmed - regenerate invite link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${SITE_URL}/accept-invite`
      }
    });

    // ... send email (same as new invite) ...

    return successResponse({
      user: { id: existingUser.id, email },
      invitation_sent: true,
      resend: true
    });
  }

  // New user - proceed with generateLink as before
  // ...
}
```

### Phase 6: Translations

**Files**: `messages/en.json`, `messages/pt-PT.json`

Add keys:

```json
// English
{
  "send_invitation_email": "Send invitation email",
  "set_password_manually": "Set password manually",
  "invitation_sent": "Invitation sent to {email}",
  "resend_invitation": "Resend Invitation",
  "invitation_pending": "Invitation pending",
  "set_your_password": "Set Your Password",
  "confirm_password": "Confirm Password",
  "set_password_button": "Set Password",
  "password_hint": "Minimum 6 characters",
  "invitation_expired": "This invitation link has expired",
  "invitation_invalid": "This invitation link is invalid",
  "invitation_error_title": "Invitation Error",
  "invitation_contact_courier": "Please contact your courier for a new invitation",
  "verifying_invitation": "Verifying invitation..."
}

// Portuguese
{
  "send_invitation_email": "Enviar email de convite",
  "set_password_manually": "Definir palavra-passe manualmente",
  "invitation_sent": "Convite enviado para {email}",
  "resend_invitation": "Reenviar Convite",
  "invitation_pending": "Convite pendente",
  "set_your_password": "Defina a Sua Palavra-passe",
  "confirm_password": "Confirmar Palavra-passe",
  "set_password_button": "Definir Palavra-passe",
  "password_hint": "Mínimo de 6 caracteres",
  "invitation_expired": "Este link de convite expirou",
  "invitation_invalid": "Este link de convite é inválido",
  "invitation_error_title": "Erro no Convite",
  "invitation_contact_courier": "Por favor contacte o seu estafeta para um novo convite",
  "verifying_invitation": "A verificar convite..."
}
```

### Phase 7: Config Updates

**File**: `supabase/config.toml`

Add redirect URLs:
```toml
additional_redirect_urls = [
  # ... existing ...
  "https://barecourier.vercel.app/accept-invite",
  "https://barecourier.vercel.app/pt-PT/accept-invite",
  "http://localhost:5173/accept-invite",
  "http://localhost:5173/pt-PT/accept-invite",
]
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] Toggle on create client form: "Send invitation email" (default ON)
- [ ] When toggle ON: password field hidden, invitation email sent
- [ ] When toggle OFF: password field shown, existing flow works
- [ ] Client receives branded invitation email within 60 seconds
- [ ] Email contains courier name and personalized welcome
- [ ] Clicking link opens `/accept-invite` page
- [ ] Client can set password (minimum 6 characters)
- [ ] After setting password, client is logged in and redirected to `/client`
- [ ] Courier can resend invitation for unconfirmed clients
- [ ] Error shown if email already registered (confirmed user)
- [ ] Expired link shows appropriate error with instructions
- [ ] Invalid link shows appropriate error with instructions
- [ ] Flow works in both English and Portuguese

### Non-Functional Requirements

- [ ] Invitation email matches existing email template styling
- [ ] Page loads in < 3 seconds on 3G connection
- [ ] Flow works on mobile browsers (iOS Safari, Android Chrome)
- [ ] Error messages are user-friendly (not technical)

### Security Requirements

- [ ] Only couriers can send invitations (role check)
- [ ] Invitation links expire after 24 hours
- [ ] Links are single-use (cannot be reused after password set)
- [ ] Profile role is always 'client' (cannot be elevated via metadata)

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/routes/accept-invite/+page.svelte` | Password setting page |
| `src/routes/accept-invite/+page.ts` | Page load function |

### Modified Files
| File | Changes |
|------|---------|
| `supabase/functions/create-client/index.ts` | Add invitation mode with `send_invitation` parameter |
| `supabase/functions/send-email/index.ts` | Add `client_invitation` template |
| `supabase/functions/_shared/email-translations.ts` | Add invitation email translations |
| `src/routes/courier/clients/new/+page.svelte` | Add toggle, conditional password field |
| `src/routes/courier/clients/[id]/+page.svelte` | Add resend invitation button |
| `messages/en.json` | Add ~13 new translation keys |
| `messages/pt-PT.json` | Add ~13 new translation keys |
| `supabase/config.toml` | Add accept-invite redirect URLs |

---

## Error Handling

### Duplicate Email (Confirmed User)
```typescript
if (existingUser?.email_confirmed_at) {
  return errorResponse('This email is already registered', 400);
}
```
UI shows: "This email is already registered"

### Duplicate Email (Unconfirmed User)
Automatically treated as resend invitation. New link generated and sent.

### Email Delivery Failure
```typescript
if (!emailResponse.ok) {
  return errorResponse('Failed to send invitation email', 500);
}
```
UI shows: "Failed to send invitation email. Please try again."

### Expired Link
Detected via URL error params. Shows friendly message with instructions to contact courier.

### Invalid Link
Same handling as expired - shows error with contact instructions.

---

## Testing Plan

### Manual Testing
1. **Happy path (invitation)**: Toggle ON → create client → receive email → click link → set password → access dashboard
2. **Happy path (password)**: Toggle OFF → create client with password → client can login
3. **Expired link**: Wait 24+ hours (or modify token) → see expiry message
4. **Invalid link**: Tamper with URL → see invalid message
5. **Duplicate confirmed email**: Try to invite existing client → see error
6. **Resend invitation**: Create client → don't accept → use resend button → receive new email
7. **Mobile**: Complete invitation flow on iOS Safari and Android Chrome
8. **Localization**: Switch to PT-PT → verify all strings translated

### Edge Cases
- [ ] Click invitation link while already logged in as courier
- [ ] Submit form with mismatched passwords
- [ ] Submit with password < 6 characters
- [ ] Network error during password submit
- [ ] Browser back button after setting password

---

## Migration Strategy

No migration needed:
- Existing clients with passwords continue to work
- New clients can use either flow based on courier preference
- Both flows coexist in single edge function

---

## Dependencies & Risks

### Dependencies
- Supabase `auth.admin.generateLink()` API
- Resend email delivery
- Existing `send-email` edge function
- Existing `create-client` edge function structure

### Risks
| Risk | Mitigation |
|------|------------|
| Email goes to spam | Test deliverability, use verified domain |
| Link expiry confusion | Clear expiry notice in email + error page |
| Trigger race condition | Use existing retry pattern from create-client |

---

## Success Metrics

- Invitation flow adoption rate among new clients
- < 5% invitation email bounce rate
- < 10% invitation abandonment rate
- Zero support tickets about credential handoff

---

## Future Considerations

- **Client self-registration**: Allow clients to request access (courier approves)
- **Bulk invitations**: CSV upload for multiple clients
- **Invitation tracking**: Database table for audit trail and analytics
- **Custom expiry**: Allow courier to set shorter/longer expiry

---

## References

### Internal
- `supabase/functions/create-client/index.ts:110-147` - Retry pattern for profile race condition
- `supabase/functions/create-client/index.ts:13-27` - CORS pattern for preview deployments
- `supabase/functions/send-email/index.ts` - Email template structure
- `src/routes/reset-password/+page.svelte` - Auth state handling pattern

### External
- [Supabase generateLink API](https://supabase.com/docs/reference/javascript/auth-admin-generatelink)
- [Supabase inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)

---

## Implementation Checklist

### Phase 1: Edge Function Modification
- [x] Add `send_invitation` parameter handling to `create-client`
- [x] Implement `generateLink({ type: 'invite' })` branch
- [x] Fetch courier profile for personalized email
- [x] Call `send-email` with `client_invitation` template
- [x] Handle existing unconfirmed user (resend case)
- [x] Handle existing confirmed user (error case)
- [x] Return 500 if email fails
- [x] Use existing retry pattern for profile race condition
- [ ] Test locally with both flows

### Phase 2: Email Template
- [x] Add `client_invitation` case to `send-email/index.ts`
- [x] Add email translations to `email-translations.ts` (EN + PT-PT)
- [ ] Test email rendering in both locales
- [ ] Verify link works in email clients (Gmail, Outlook)

### Phase 3: Accept Invite Page
- [x] Create `src/routes/accept-invite/+page.svelte`
- [x] Create `src/routes/accept-invite/+page.ts`
- [x] Implement auth state detection (SIGNED_IN event)
- [x] Implement password form with validation
- [x] Implement `updateUser({ password })`
- [x] Handle expired link error
- [x] Handle invalid link error
- [x] Redirect to `/client` on success (stay logged in)

### Phase 4: Courier UI Updates
- [x] Add Switch toggle to `courier/clients/new/+page.svelte`
- [x] Conditionally show/hide password field based on toggle
- [x] Update submit handler to include `send_invitation` param
- [x] Show toast "Invitation sent to {email}" + redirect to `/courier/clients`

### Phase 5: Check Status Endpoint & Resend Invitation
- [x] Create `check-client-status` edge function (uses admin API to check `email_confirmed_at`)
- [x] Add "Resend Invitation" button to `courier/clients/[id]/+page.svelte`
- [x] Call check-client-status to determine button visibility
- [x] Implement resend via `create-client` with `send_invitation=true`

### Phase 6: Translations
- [x] Add English translations to `messages/en.json`
- [x] Add Portuguese translations to `messages/pt-PT.json`

### Phase 7: Config
- [x] Add redirect URLs to `supabase/config.toml`
- [x] Add `check-client-status` function config
- [ ] Deploy edge function changes
- [ ] Test end-to-end on staging

---

*Plan created: 2026-02-04*
*Last updated: 2026-02-04 (revised after review)*
