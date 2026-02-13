<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { localizeHref } from "$lib/paraglide/runtime.js";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let email = $state("");
  let password = $state("");
  let loading = $state(false);
  let error = $state("");

  /**
   * Maps Supabase auth error messages to user-friendly localized messages.
   * Prevents exposing internal auth implementation details.
   */
  function mapAuthError(errorMessage: string): string {
    const errorMap: Record<string, () => string> = {
      "Invalid login credentials": () => m.auth_error_invalid_credentials(),
      "Email not confirmed": () => m.auth_error_email_not_confirmed(),
      "User not found": () => m.auth_error_invalid_credentials(),
      "Invalid email or password": () => m.auth_error_invalid_credentials(),
      "Too many requests": () => m.auth_error_too_many_requests(),
      "Email rate limit exceeded": () => m.auth_error_too_many_requests(),
      "User already registered": () => m.auth_error_already_registered(),
    };

    // Check for exact match first
    if (errorMap[errorMessage]) {
      return errorMap[errorMessage]();
    }

    // Check for partial matches (some errors include dynamic content)
    for (const [key, valueFn] of Object.entries(errorMap)) {
      if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
        return valueFn();
      }
    }

    // Generic fallback - don't expose raw error
    return m.auth_error_generic();
  }

  async function handleLogin(e: Event) {
    e.preventDefault();
    loading = true;
    error = "";

    const { error: authError } = await data.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      error = mapAuthError(authError.message);
      loading = false;
      return;
    }

    // Redirect to intended destination or home
    goto(data.redirectTo || localizeHref("/"));
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <img src="/favicon.svg" alt="" class="mx-auto mb-2 h-10 w-auto" />
      <Card.Title class="text-2xl">{m.app_name()}</Card.Title>
      <Card.Description>{m.auth_sign_in_subtitle()}</Card.Description>
    </Card.Header>
    <Card.Content>
      <form onsubmit={handleLogin} class="space-y-4">
        {#if error}
          <div
            class="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        {/if}

        <div class="space-y-2">
          <Label for="email">{m.auth_email()}</Label>
          <Input
            id="email"
            type="email"
            placeholder={m.auth_email_placeholder()}
            bind:value={email}
            required
            disabled={loading}
          />
        </div>

        <div class="space-y-2">
          <Label for="password">{m.auth_password()}</Label>
          <Input
            id="password"
            type="password"
            placeholder={m.auth_password_placeholder()}
            bind:value={password}
            required
            disabled={loading}
          />
        </div>

        <Button type="submit" class="w-full" disabled={loading}>
          {loading ? m.auth_signing_in() : m.auth_sign_in()}
        </Button>

        <div class="text-center">
          <a
            href={localizeHref("/forgot-password")}
            class="text-sm text-muted-foreground hover:text-foreground underline"
          >
            {m.auth_forgot_password()}
          </a>
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</div>
