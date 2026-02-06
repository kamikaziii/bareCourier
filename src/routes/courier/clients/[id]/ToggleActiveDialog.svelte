<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { invalidateAll } from "$app/navigation";
  import { toast } from "$lib/utils/toast.js";

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

  async function handleToggleActive() {
    loading = true;

    try {
      const response = await fetch(`?/toggleActive`, { method: "POST" });

      if (response.ok) {
        const result = await response.json();
        if (result.type === "success" || result.data?.success) {
          await invalidateAll();
          open = false;
          toast.success(
            clientActive
              ? m.toast_client_deactivated()
              : m.toast_client_activated(),
          );
        } else {
          toast.error(m.toast_error_generic(), { duration: 8000 });
        }
      } else {
        toast.error(m.toast_error_generic(), { duration: 8000 });
      }
    } catch {
      toast.error(m.toast_error_generic(), { duration: 8000 });
    }
    loading = false;
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
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={loading}>
        {m.action_cancel()}
      </AlertDialog.Cancel>
      <AlertDialog.Action onclick={handleToggleActive} disabled={loading}>
        {loading ? m.loading() : m.action_confirm()}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
