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

  let newPassword = $state("");
  let confirmPassword = $state("");
  let loading = $state(false);
  let error = $state("");
  let success = $state(false);
  let isValidSession = $state(false);
  let checking = $state(true);

  const passwordsMatch = $derived(newPassword === confirmPassword);
  const isValid = $derived(newPassword.length >= 6 && passwordsMatch);

  onMount(() => {
    // Listen for PASSWORD_RECOVERY event when Supabase validates the token
    const { data: authListener } = data.supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          isValidSession = true;
          checking = false;
        } else if (event === "SIGNED_IN") {
          // User was already signed in or token was already processed
          isValidSession = true;
          checking = false;
        }
      },
    );

    // Set a timeout to show error if no event fires
    const timeout = setTimeout(() => {
      if (checking) {
        checking = false;
        // Check if we have a valid session anyway
        data.supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            isValidSession = true;
          }
        });
      }
    }, 3000);

    return () => {
      authListener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    error = "";

    const { error: updateError } = await data.supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      error = m.reset_password_error();
      loading = false;
      return;
    }

    // Password updated - sign out and redirect to login
    success = true;
    await data.supabase.auth.signOut();

    setTimeout(() => {
      goto(localizeHref("/login"));
    }, 2000);
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl">{m.reset_password_title()}</Card.Title>
      <Card.Description>{m.reset_password_desc()}</Card.Description>
    </Card.Header>
    <Card.Content>
      {#if checking}
        <div class="py-8 text-center text-muted-foreground">
          {m.loading()}
        </div>
      {:else if success}
        <div class="space-y-4">
          <div
            class="rounded-md bg-green-500/10 p-4 text-center text-green-600"
          >
            {m.reset_password_success()}
          </div>
        </div>
      {:else if !isValidSession}
        <div class="space-y-4">
          <div
            class="rounded-md bg-destructive/10 p-4 text-center text-destructive"
          >
            {m.reset_password_invalid()}
          </div>
          <div class="text-center">
            <a
              href={localizeHref("/forgot-password")}
              class="text-sm text-muted-foreground hover:text-foreground underline"
            >
              {m.forgot_password_submit()}
            </a>
          </div>
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
            <Label for="new_password">{m.password_new()}</Label>
            <Input
              id="new_password"
              type="password"
              bind:value={newPassword}
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
            <Label for="confirm_password">{m.password_confirm()}</Label>
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
            {loading ? m.saving() : m.reset_password_submit()}
          </Button>
        </form>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
