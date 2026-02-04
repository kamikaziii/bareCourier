<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { PUBLIC_SUPABASE_URL } from "$env/static/public";
  import type { SupabaseClient } from "@supabase/supabase-js";

  let {
    open = $bindable(false),
    clientId,
    supabase,
  }: {
    open: boolean;
    clientId: string;
    supabase: SupabaseClient;
  } = $props();

  let loading = $state(false);
  let error = $state("");
  let success = $state(false);
  let newPassword = $state("");

  // Reset state when dialog opens
  $effect(() => {
    if (open) {
      newPassword = "";
      error = "";
      success = false;
      loading = false;
    }
  });

  async function handleResetPassword() {
    if (newPassword.length < 6) {
      error = m.password_min_length();
      return;
    }

    loading = true;
    error = "";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        error = m.session_expired();
        loading = false;
        return;
      }

      const response = await fetch(
        `${PUBLIC_SUPABASE_URL}/functions/v1/reset-client-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            client_id: clientId,
            new_password: newPassword,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        error = result.error || m.password_reset_error();
      } else {
        success = true;
        newPassword = "";
        // Auto-close after showing success
        setTimeout(() => {
          open = false;
          success = false;
        }, 2000);
      }
    } catch {
      error = m.password_reset_error();
    }

    loading = false;
  }

  function handleCancel() {
    error = "";
    newPassword = "";
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{m.password_reset_client()}</AlertDialog.Title>
      <AlertDialog.Description>
        {m.password_reset_client_desc()}
      </AlertDialog.Description>
    </AlertDialog.Header>

    {#if success}
      <div class="rounded-md bg-green-500/10 p-3 text-green-600">
        {m.password_reset_success()}
      </div>
    {:else}
      <div class="space-y-4">
        {#if error}
          <div
            class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        {/if}

        <div class="space-y-2">
          <Label for="new_client_password">{m.password_new_for_client()}</Label>
          <Input
            id="new_client_password"
            type="password"
            bind:value={newPassword}
            disabled={loading}
            minlength={6}
            autocomplete="new-password"
          />
          <p class="text-xs text-muted-foreground">{m.password_min_length()}</p>
        </div>
      </div>
    {/if}

    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={loading} onclick={handleCancel}>
        {m.action_cancel()}
      </AlertDialog.Cancel>
      {#if !success}
        <Button
          onclick={handleResetPassword}
          disabled={loading || newPassword.length < 6}
        >
          {loading ? m.saving() : m.action_confirm()}
        </Button>
      {/if}
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
