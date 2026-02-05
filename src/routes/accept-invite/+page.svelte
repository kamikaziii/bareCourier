<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { localizeHref } from "$lib/paraglide/runtime.js";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let password = $state("");
  let confirmPassword = $state("");
  let loading = $state(false);
  let error = $state("");
  let authError = $state("");
  let sessionReady = $state(false);
  let checking = $state(true);

  const passwordsMatch = $derived(password === confirmPassword);
  const isValid = $derived(password.length >= 6 && passwordsMatch);

  onMount(() => {
    let authSubscription: { unsubscribe: () => void } | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    // Check for error params in URL (expired/invalid token)
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error_description") || params.get("error");
    if (errorParam) {
      authError = errorParam.includes("expired")
        ? m.invitation_expired()
        : m.invitation_invalid();
      checking = false;
      return;
    }

    // Check session FIRST - invite link may have already signed user in
    data.supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) {
        sessionReady = true;
        checking = false;
        return;
      }

      // No session found - set up listener for SIGNED_IN event
      // This handles the case where Supabase is still processing the invite token from URL
      const { data: authListener } = data.supabase.auth.onAuthStateChange(
        (event) => {
          if (event === "SIGNED_IN") {
            sessionReady = true;
            checking = false;
          }
        },
      );
      authSubscription = authListener.subscription;

      // Final fallback timeout for truly invalid/expired links
      timeout = setTimeout(() => {
        if (checking) {
          checking = false;
          authError = m.invitation_invalid();
        }
      }, 5000);
    });

    return () => {
      authSubscription?.unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    error = "";

    if (password.length < 6) {
      error = m.password_min_length();
      loading = false;
      return;
    }

    if (!passwordsMatch) {
      error = m.password_mismatch();
      loading = false;
      return;
    }

    const { error: updateError } = await data.supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      // Map common auth errors to user-friendly messages
      if (updateError.message.includes("expired")) {
        error = m.password_link_expired();
      } else if (updateError.message.includes("weak")) {
        error = m.password_too_weak();
      } else {
        error = m.error_setting_password();
      }
      loading = false;
      return;
    }

    // Success - redirect to client dashboard (stay logged in)
    goto(localizeHref("/client"), { replaceState: true });
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl">{m.set_your_password()}</Card.Title>
      <Card.Description>{m.invitation_set_password_desc()}</Card.Description>
    </Card.Header>
    <Card.Content>
      {#if checking}
        <div class="py-8 text-center text-muted-foreground">
          {m.verifying_invitation()}
        </div>
      {:else if authError}
        <div class="space-y-4">
          <div
            class="rounded-md bg-destructive/10 p-4 text-center text-destructive"
          >
            {authError}
          </div>
          <p class="text-center text-sm text-muted-foreground">
            {m.invitation_contact_courier()}
          </p>
        </div>
      {:else if !sessionReady}
        <div class="space-y-4">
          <div
            class="rounded-md bg-destructive/10 p-4 text-center text-destructive"
          >
            {m.invitation_invalid()}
          </div>
          <p class="text-center text-sm text-muted-foreground">
            {m.invitation_contact_courier()}
          </p>
        </div>
      {:else}
        <form onsubmit={handleSubmit} class="space-y-4">
          {#if error}
            <div
              class="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          {/if}

          <div class="space-y-2">
            <Label for="password">{m.password()}</Label>
            <Input
              id="password"
              type="password"
              bind:value={password}
              required
              disabled={loading}
              minlength={6}
              autocomplete="new-password"
            />
            <p class="text-xs text-muted-foreground">
              {m.password_min_length()}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="confirm_password">{m.confirm_password()}</Label>
            <Input
              id="confirm_password"
              type="password"
              bind:value={confirmPassword}
              required
              disabled={loading}
              autocomplete="new-password"
            />
            {#if confirmPassword && !passwordsMatch}
              <p class="text-xs text-destructive">{m.password_mismatch()}</p>
            {/if}
          </div>

          <Button type="submit" class="w-full" disabled={loading || !isValid}>
            {loading ? m.saving() : m.set_password_button()}
          </Button>
        </form>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
