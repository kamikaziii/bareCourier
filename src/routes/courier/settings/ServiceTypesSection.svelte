<script lang="ts">
  import { enhance, applyAction } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { toast } from "$lib/utils/toast.js";
  import { formatCurrency } from "$lib/utils.js";
  import { Tags, Plus, Trash2, Power, Pencil } from "@lucide/svelte";
  import type { ServiceType } from "$lib/database.types.js";

  interface Props {
    serviceTypes: ServiceType[];
  }

  let { serviceTypes }: Props = $props();

  // State for new service type form
  let showNewForm = $state(false);
  let newServiceType = $state({ name: "", price: "", description: "" });

  // State for editing
  let editingTypeId = $state<string | null>(null);

  // State for delete confirmation
  let deletingTypeId = $state<string | null>(null);
  let deleteDialogOpen = $state(false);

  function openDeleteDialog(typeId: string) {
    deletingTypeId = typeId;
    deleteDialogOpen = true;
  }

  function resetNewForm() {
    newServiceType = { name: "", price: "", description: "" };
    showNewForm = false;
  }
</script>

<Card.Root>
  <Card.Header>
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <Card.Title class="flex items-center gap-2">
          <Tags class="size-5" />
          {m.service_types()}
        </Card.Title>
        <Card.Description>
          {m.service_types_desc()}
        </Card.Description>
      </div>
      <Button
        variant="outline"
        onclick={() => (showNewForm = !showNewForm)}
        class="w-full sm:w-auto"
      >
        <Plus class="mr-2 size-4" />
        {m.add_service_type()}
      </Button>
    </div>
  </Card.Header>
  <Card.Content class="space-y-4">
    <!-- New service type form -->
    {#if showNewForm}
      <form
        method="POST"
        action="?/createServiceType"
        use:enhance={async () => {
          return async ({ result }) => {
            await applyAction(result);
            if (result.type === "success") {
              resetNewForm();
              await invalidateAll();
              toast.success(m.toast_service_type_created());
            }
          };
        }}
        class="space-y-4 rounded-lg border p-4"
      >
        <h4 class="font-medium">{m.new_service_type()}</h4>
        <div class="grid gap-4 md:grid-cols-3">
          <div class="space-y-2">
            <Label for="new_type_name">{m.form_name()}</Label>
            <Input
              id="new_type_name"
              name="name"
              bind:value={newServiceType.name}
              placeholder={m.service_type_name_placeholder()}
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="new_type_price">{m.price()}</Label>
            <Input
              id="new_type_price"
              name="price"
              type="number"
              step="0.01"
              min="0"
              bind:value={newServiceType.price}
              placeholder="0.00"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="new_type_desc">{m.settings_description()}</Label>
            <Input
              id="new_type_desc"
              name="description"
              bind:value={newServiceType.description}
              placeholder={m.service_type_desc_placeholder()}
            />
          </div>
        </div>
        <div class="flex gap-2">
          <Button type="submit">{m.action_save()}</Button>
          <Button
            type="button"
            variant="outline"
            onclick={() => (showNewForm = false)}
          >
            {m.action_cancel()}
          </Button>
        </div>
      </form>
    {/if}

    <!-- List of service types -->
    <div class="space-y-3">
      {#if serviceTypes.length === 0}
        <div class="rounded-lg border border-dashed p-4 text-center sm:p-6">
          <Tags class="mx-auto size-8 text-muted-foreground" />
          <p class="mt-2 text-sm text-muted-foreground">
            {m.no_service_types()}
          </p>
          <Button
            variant="outline"
            class="mt-4 h-auto max-w-full whitespace-normal px-3 py-2"
            onclick={() => (showNewForm = true)}
          >
            <Plus class="mr-2 size-4 shrink-0" />
            <span>{m.add_first_service_type()}</span>
          </Button>
        </div>
      {:else}
        {#each serviceTypes as type (type.id)}
          <div class="rounded-lg border p-4 {type.active ? '' : 'opacity-60'}">
            {#if editingTypeId === type.id}
              <!-- Edit form -->
              <form
                method="POST"
                action="?/updateServiceType"
                use:enhance={async () => {
                  return async ({ result }) => {
                    await applyAction(result);
                    if (result.type === "success") {
                      editingTypeId = null;
                      await invalidateAll();
                      toast.success(m.toast_service_type_updated());
                    }
                  };
                }}
              >
                <input type="hidden" name="id" value={type.id} />
                <input
                  type="hidden"
                  name="active"
                  value={(type.active ?? true).toString()}
                />
                <div class="grid gap-4 md:grid-cols-3">
                  <div class="space-y-2">
                    <Label>{m.form_name()}</Label>
                    <Input name="name" value={type.name} required />
                  </div>
                  <div class="space-y-2">
                    <Label>{m.price()}</Label>
                    <Input
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={type.price}
                      required
                    />
                  </div>
                  <div class="space-y-2">
                    <Label>{m.settings_description()}</Label>
                    <Input name="description" value={type.description || ""} />
                  </div>
                </div>
                <div class="mt-4 flex gap-2">
                  <Button type="submit" size="sm">{m.action_save()}</Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onclick={() => (editingTypeId = null)}
                  >
                    {m.action_cancel()}
                  </Button>
                </div>
              </form>
            {:else}
              <!-- Display mode -->
              <div
                class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div class="min-w-0 flex-1">
                  <h4 class="font-medium">{type.name}</h4>
                  <p class="truncate text-sm text-muted-foreground">
                    {type.description || "-"}
                  </p>
                </div>
                <div
                  class="flex items-center justify-between gap-2 sm:justify-end"
                >
                  <div class="text-left sm:mr-2 sm:text-right">
                    <p class="text-sm font-medium">
                      {formatCurrency(type.price)}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {type.active ? m.status_active() : m.settings_inactive()}
                    </p>
                  </div>
                  <div class="flex items-center gap-1">
                    <!-- Toggle active/inactive -->
                    <form
                      method="POST"
                      action="?/toggleServiceType"
                      use:enhance={async () => {
                        return async ({ result }) => {
                          await applyAction(result);
                          if (result.type === "success") {
                            await invalidateAll();
                            toast.success(m.toast_service_type_updated());
                          }
                        };
                      }}
                    >
                      <input type="hidden" name="id" value={type.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={(type.active ?? true).toString()}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        title={type.active
                          ? m.settings_deactivate()
                          : m.settings_activate()}
                      >
                        <Power
                          class="size-4 {type.active
                            ? 'text-green-500'
                            : 'text-muted-foreground'}"
                        />
                      </Button>
                    </form>
                    <!-- Edit -->
                    <Button
                      variant="ghost"
                      size="icon"
                      onclick={() => (editingTypeId = type.id)}
                    >
                      <span class="sr-only">{m.action_edit()}</span>
                      <Pencil class="size-4" />
                    </Button>
                    <!-- Delete -->
                    <Button
                      variant="ghost"
                      size="icon"
                      class="text-destructive hover:text-destructive"
                      onclick={() => openDeleteDialog(type.id)}
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </Card.Content>
</Card.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>
        {m.delete_service_type()}
      </AlertDialog.Title>
      <AlertDialog.Description>
        {m.delete_service_type_confirm()}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => (deleteDialogOpen = false)}>
        {m.action_cancel()}
      </AlertDialog.Cancel>
      <form
        method="POST"
        action="?/deleteServiceType"
        use:enhance={async () => {
          return async ({ result }) => {
            await applyAction(result);
            deleteDialogOpen = false;
            deletingTypeId = null;
            if (result.type === "success") {
              await invalidateAll();
              toast.success(m.toast_service_type_deleted());
            }
          };
        }}
        class="inline"
      >
        <input type="hidden" name="id" value={deletingTypeId} />
        <AlertDialog.Action
          type="submit"
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {m.action_delete()}
        </AlertDialog.Action>
      </form>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
