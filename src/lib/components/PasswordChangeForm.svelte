<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { localizeHref } from "$lib/paraglide/runtime.js";
  import { Lock } from "@lucide/svelte";
  import type { SupabaseClient } from "@supabase/supabase-js";
  import type { Database } from "$lib/database.types.js";

  interface Props {
    supabase: SupabaseClient<Database>;
    userEmail: string;
  }

  let { supabase, userEmail }: Props = $props();

  let currentPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let loading = $state(false);
  let error = $state("");
  let success = $state(false);

  const passwordsMatch = $derived(newPassword === confirmPassword);
  const isValid = $derived(
    currentPassword.length > 0 && newPassword.length >= 6 && passwordsMatch,
  );

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    error = "";

    // Step 1: Verify current password by reauthenticating
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (authError) {
      error = m.password_current_incorrect();
      loading = false;
      return;
    }

    // Step 2: Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      error = updateError.message;
      loading = false;
      return;
    }

    // Password change invalidates all sessions - redirect to login
    success = true;
    await supabase.auth.signOut();

    // Wait a moment for the user to see the success message
    setTimeout(() => {
      goto(localizeHref("/login"));
    }, 2000);
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Lock class="size-5" />
      {m.password_change_title()}
    </Card.Title>
    <Card.Description>{m.password_change_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    {#if success}
      <div class="rounded-md bg-green-500/10 p-3 text-green-600">
        {m.password_change_success()}
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
          <Label for="current_password">{m.password_current()}</Label>
          <Input
            id="current_password"
            type="password"
            bind:value={currentPassword}
            required
            disabled={loading}
            autocomplete="current-password"
          />
        </div>

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
          <p class="text-xs text-muted-foreground">{m.password_min_length()}</p>
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

        <Button type="submit" disabled={loading || !isValid}>
          {loading ? m.saving() : m.password_change_button()}
        </Button>
      </form>
    {/if}
  </Card.Content>
</Card.Root>
