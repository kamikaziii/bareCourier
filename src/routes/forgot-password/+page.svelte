<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { toast } from "$lib/utils/toast.js";
  import { localizeHref } from "$lib/paraglide/runtime.js";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let email = $state("");
  let loading = $state(false);
  let submitted = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;

    try {
      await data.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${localizeHref("/reset-password")}`,
      });
    } catch {
      // Only show error for network failures, not for email existence
      toast.error(m.toast_error_network(), { duration: 8000 });
      loading = false;
      return;
    }

    // Always show success message regardless of whether email exists
    // This prevents email enumeration attacks
    toast.success(m.toast_password_reset_sent());
    submitted = true;
    loading = false;
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl">{m.forgot_password_title()}</Card.Title>
      <Card.Description>{m.forgot_password_desc()}</Card.Description>
    </Card.Header>
    <Card.Content>
      {#if submitted}
        <div class="text-center">
          <a
            href={localizeHref("/login")}
            class="text-sm text-muted-foreground hover:text-foreground underline"
          >
            {m.forgot_password_back()}
          </a>
        </div>
      {:else}
        <form onsubmit={handleSubmit} class="space-y-4">
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

          <Button type="submit" class="w-full" disabled={loading || !email}>
            {loading ? m.loading() : m.forgot_password_submit()}
          </Button>

          <div class="text-center">
            <a
              href={localizeHref("/login")}
              class="text-sm text-muted-foreground hover:text-foreground underline"
            >
              {m.forgot_password_back()}
            </a>
          </div>
        </form>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
