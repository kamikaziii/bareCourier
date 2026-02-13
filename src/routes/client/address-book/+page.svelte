<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import AddressInput from "$lib/components/AddressInput.svelte";
  import * as m from "$lib/paraglide/messages.js";
  import { toast } from "$lib/utils/toast.js";
  import type { PageData } from "./$types";
  import type { ClientAddress } from "$lib/database.types.js";
  import { BookUser, Plus, Pencil, Trash2, Search } from "@lucide/svelte";

  let { data }: { data: PageData } = $props();

  const PAGE_SIZE = 20;

  // Dialog states
  let dialogOpen = $state(false);
  let deleteDialogOpen = $state(false);
  let editingAddress = $state<ClientAddress | null>(null);
  let deletingAddress = $state<ClientAddress | null>(null);

  // Form fields
  let formLabel = $state("");
  let formAddress = $state("");
  let formCoords = $state<[number, number] | null>(null);

  // Search
  let searchTerm = $state(data.search || "");
  let searchTimeout: ReturnType<typeof setTimeout>;

  // Pagination
  const totalPages = $derived(
    Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)),
  );

  function openCreateDialog() {
    editingAddress = null;
    formLabel = "";
    formAddress = "";
    formCoords = null;
    dialogOpen = true;
  }

  function openEditDialog(addr: ClientAddress) {
    editingAddress = addr;
    formLabel = addr.label;
    formAddress = addr.address;
    formCoords =
      addr.lat != null && addr.lng != null ? [addr.lng, addr.lat] : null;
    dialogOpen = true;
  }

  function openDeleteDialog(addr: ClientAddress) {
    deletingAddress = addr;
    deleteDialogOpen = true;
  }

  function handleAddressSelect(
    address: string,
    coords: [number, number] | null,
  ) {
    formAddress = address;
    formCoords = coords;
  }

  function handleSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    searchTerm = value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const url = new URL(page.url);
      if (value) {
        url.searchParams.set("search", value);
      } else {
        url.searchParams.delete("search");
      }
      url.searchParams.delete("page");
      goto(url.toString(), { replaceState: true, keepFocus: true });
    }, 300);
  }

  function goToPage(p: number) {
    const url = new URL(page.url);
    if (p <= 1) {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", String(p));
    }
    goto(url.toString(), { replaceState: true });
  }

  function handleFormSubmit() {
    return async ({
      result,
    }: {
      result: { type: string; data?: { error?: string; success?: boolean } };
    }) => {
      if (result.type === "success") {
        await invalidateAll();
        dialogOpen = false;
        toast.success(
          editingAddress ? m.toast_address_updated() : m.toast_address_saved(),
        );
      } else {
        toast.error(m.toast_error_generic(), { duration: 8000 });
      }
    };
  }

  function handleDeleteSubmit() {
    return async ({
      result,
    }: {
      result: { type: string; data?: { error?: string; success?: boolean } };
    }) => {
      if (result.type === "success") {
        await invalidateAll();
        deleteDialogOpen = false;
        deletingAddress = null;
        toast.success(m.toast_address_deleted());
      } else {
        toast.error(m.toast_error_generic(), { duration: 8000 });
      }
    };
  }
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <BookUser class="size-6" />
      <div>
        <h1 class="text-2xl font-bold">{m.address_book_title()}</h1>
        <p class="text-sm text-muted-foreground">{m.address_book_subtitle()}</p>
      </div>
    </div>
    <Button onclick={openCreateDialog} size="sm">
      <Plus class="mr-1 size-4" />
      {m.address_book_add()}
    </Button>
  </div>

  <!-- Search -->
  <div class="relative">
    <Search
      class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
    />
    <Input
      placeholder={m.address_book_search_placeholder()}
      value={searchTerm}
      oninput={handleSearchInput}
      class="pl-9"
    />
  </div>

  <!-- Address List -->
  {#if data.addresses.length === 0}
    <div
      class="flex flex-col items-center justify-center gap-2 py-12 text-center"
    >
      <BookUser class="size-12 text-muted-foreground/50" />
      {#if data.search}
        <p class="text-muted-foreground">{m.address_book_no_results()}</p>
      {:else}
        <p class="font-medium">{m.address_book_empty()}</p>
        <p class="text-sm text-muted-foreground">
          {m.address_book_empty_desc()}
        </p>
      {/if}
    </div>
  {:else}
    <div class="space-y-2">
      {#each data.addresses as addr (addr.id)}
        <Card.Root class="flex items-center justify-between p-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">{addr.label}</p>
            <p class="truncate text-sm text-muted-foreground">{addr.address}</p>
          </div>
          <div class="ml-2 flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="size-8"
              onclick={() => openEditDialog(addr)}
            >
              <Pencil class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-8"
              onclick={() => openDeleteDialog(addr)}
            >
              <Trash2 class="size-4" />
            </Button>
          </div>
        </Card.Root>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex items-center justify-center gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          disabled={data.page <= 1}
          onclick={() => goToPage(data.page - 1)}
        >
          {m.pagination_previous()}
        </Button>
        <span class="text-sm text-muted-foreground">
          {data.page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={data.page >= totalPages}
          onclick={() => goToPage(data.page + 1)}
        >
          {m.pagination_next()}
        </Button>
      </div>
    {/if}
  {/if}
</div>

<!-- Add/Edit Dialog -->
<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>
        {editingAddress ? m.address_book_edit() : m.address_book_add()}
      </Dialog.Title>
    </Dialog.Header>
    <form
      method="POST"
      action={editingAddress ? "?/update" : "?/create"}
      use:enhance={handleFormSubmit}
      class="space-y-4"
    >
      {#if editingAddress}
        <input type="hidden" name="id" value={editingAddress.id} />
      {/if}
      <div class="space-y-2">
        <Label for="address-label">{m.address_book_label()}</Label>
        <Input
          id="address-label"
          name="label"
          placeholder={m.address_book_label_placeholder()}
          value={formLabel}
          oninput={(e) => {
            formLabel = (e.target as HTMLInputElement).value;
          }}
          required
        />
      </div>
      <div class="space-y-2">
        <Label for="address-address">{m.address_book_address()}</Label>
        <AddressInput
          id="address-address"
          bind:value={formAddress}
          onSelect={handleAddressSelect}
          placeholder={m.form_pickup_placeholder()}
        />
        <input type="hidden" name="address" value={formAddress} />
        <input type="hidden" name="lat" value={formCoords?.[1] ?? ""} />
        <input type="hidden" name="lng" value={formCoords?.[0] ?? ""} />
      </div>
      <Dialog.Footer>
        <Button
          type="submit"
          disabled={!formLabel.trim() || !formAddress.trim()}
        >
          {m.action_save()}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{m.address_book_delete_title()}</AlertDialog.Title>
      <AlertDialog.Description
        >{m.address_book_delete_desc()}</AlertDialog.Description
      >
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{m.action_cancel()}</AlertDialog.Cancel>
      <form method="POST" action="?/delete" use:enhance={handleDeleteSubmit}>
        <input type="hidden" name="id" value={deletingAddress?.id ?? ""} />
        <Button type="submit" variant="destructive">{m.action_delete()}</Button>
      </form>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
