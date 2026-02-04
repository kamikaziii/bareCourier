<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { toast } from "$lib/utils/toast.js";
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

  const passwordsMatch = $derived(newPassword === confirmPassword);
  const isValid = $derived(
    currentPassword.length > 0 && newPassword.length >= 6 && passwordsMatch,
  );

  function mapAuthError(errorMessage: string): string {
    if (errorMessage.includes("Password should be at least 6 characters")) {
      return m.password_min_length();
    }
    if (errorMessage.includes("New password should be different")) {
      return m.password_must_differ();
    }
    // Fallback to generic error
    return m.error_generic();
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;

    // Step 1: Verify current password by reauthenticating
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (authError) {
      toast.error(m.password_current_incorrect(), { duration: Infinity });
      loading = false;
      return;
    }

    // Step 2: Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      toast.error(mapAuthError(updateError.message), { duration: Infinity });
      loading = false;
      return;
    }

    // Password change invalidates all sessions - redirect to login
    toast.success(m.toast_password_changed());
    await supabase.auth.signOut();

    // Wait a moment for the user to see the success toast
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
    <form onsubmit={handleSubmit} class="space-y-4">
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
  </Card.Content>
</Card.Root>
