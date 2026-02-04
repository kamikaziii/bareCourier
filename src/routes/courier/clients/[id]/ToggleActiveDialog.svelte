<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { invalidateAll } from "$app/navigation";

  let {
    open = $bindable(false),
    isActive,
  }: {
    open: boolean;
    isActive: boolean | null;
  } = $props();

  // Default to true if null (profile.active defaults to true in DB)
  const clientActive = $derived(isActive ?? true);

  let loading = $state(false);
  let error = $state("");

  async function handleToggleActive() {
    loading = true;
    error = "";

    try {
      const response = await fetch(`?/toggleActive`, { method: "POST" });

      if (response.ok) {
        const result = await response.json();
        if (result.type === "success" || result.data?.success) {
          await invalidateAll();
          open = false;
        } else {
          error = result.data?.error || "Failed to update client status";
        }
      } else {
        error = "An unexpected error occurred";
      }
    } catch {
      error = "An unexpected error occurred";
    }
    loading = false;
  }

  function handleCancel() {
    error = "";
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>
        {clientActive
          ? m.confirm_deactivate_client()
          : m.confirm_reactivate_client()}
      </AlertDialog.Title>
      <AlertDialog.Description>
        {clientActive
          ? m.confirm_deactivate_client_desc()
          : m.confirm_reactivate_client_desc()}
      </AlertDialog.Description>
    </AlertDialog.Header>
    {#if error}
      <div
        class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {error}
      </div>
    {/if}
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={loading} onclick={handleCancel}>
        {m.action_cancel()}
      </AlertDialog.Cancel>
      <AlertDialog.Action onclick={handleToggleActive} disabled={loading}>
        {loading ? m.loading() : m.action_confirm()}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
