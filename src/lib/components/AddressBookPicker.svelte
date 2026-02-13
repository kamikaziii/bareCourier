<script lang="ts">
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { toast } from "$lib/utils/toast.js";
  import { localizeHref } from "$lib/paraglide/runtime.js";
  import type { ClientAddress } from "$lib/database.types.js";
  import type { SupabaseClient } from "@supabase/supabase-js";
  import { BookUser, Save, Search } from "@lucide/svelte";

  interface Props {
    addresses: ClientAddress[];
    onSelect: (address: string, coords: [number, number] | null) => void;
    currentAddress?: string;
    currentCoords?: [number, number] | null;
    supabase: SupabaseClient;
    userId: string;
    disabled?: boolean;
    onAddressesSaved?: () => void;
  }

  let {
    addresses,
    onSelect,
    currentAddress = "",
    currentCoords = null,
    supabase,
    userId,
    disabled = false,
    onAddressesSaved,
  }: Props = $props();

  let open = $state(false);
  let searchFilter = $state("");
  let showSaveInput = $state(false);
  let saveLabel = $state("");
  let saving = $state(false);

  const filtered = $derived(
    searchFilter
      ? addresses.filter(
          (a) =>
            a.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
            a.address.toLowerCase().includes(searchFilter.toLowerCase()),
        )
      : addresses,
  );

  function handleSelect(addr: ClientAddress) {
    const coords: [number, number] | null =
      addr.lat != null && addr.lng != null ? [addr.lng, addr.lat] : null;
    onSelect(addr.address, coords);
    open = false;
    searchFilter = "";
    showSaveInput = false;
  }

  async function handleSave() {
    if (!saveLabel.trim() || !currentAddress?.trim()) return;
    if (saveLabel.trim().length > 100) {
      toast.error(m.toast_error_generic(), { duration: 8000 });
      return;
    }
    if (currentAddress.length > 500) {
      toast.error(m.toast_error_generic(), { duration: 8000 });
      return;
    }
    saving = true;
    const { error } = await supabase.from("client_addresses").insert({
      client_id: userId,
      label: saveLabel.trim(),
      address: currentAddress,
      lat: currentCoords?.[1] ?? null,
      lng: currentCoords?.[0] ?? null,
    });
    saving = false;

    if (error) {
      if (error.code === "23505") {
        toast.error(m.toast_address_duplicate_label(), { duration: 8000 });
      } else {
        toast.error(m.toast_error_generic(), { duration: 8000 });
      }
      return;
    }

    toast.success(m.toast_address_saved());
    saveLabel = "";
    showSaveInput = false;
    onAddressesSaved?.();
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    <Button
      variant="ghost"
      size="icon"
      class="size-7"
      {disabled}
      title={m.address_book_pick()}
    >
      <BookUser class="size-4" />
    </Button>
  </Popover.Trigger>
  <Popover.Content class="w-72 p-0" align="end">
    {#if addresses.length > 0}
      <!-- Search filter -->
      <div class="p-2 border-b">
        <div class="relative">
          <Search
            class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder={m.address_book_search_placeholder()}
            bind:value={searchFilter}
            class="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      <!-- Address list -->
      <div class="max-h-60 overflow-y-auto">
        {#if filtered.length === 0}
          <p class="p-3 text-center text-sm text-muted-foreground">
            {m.address_book_no_results()}
          </p>
        {:else}
          {#each filtered as addr (addr.id)}
            <button
              type="button"
              class="w-full px-3 py-2 text-left hover:bg-accent transition-colors"
              onclick={() => handleSelect(addr)}
            >
              <p class="text-sm font-medium truncate">{addr.label}</p>
              <p class="text-xs text-muted-foreground truncate">
                {addr.address}
              </p>
            </button>
          {/each}
        {/if}
      </div>
    {:else if !currentAddress}
      <!-- No addresses and no current address -->
      <div class="p-4 text-center space-y-2">
        <p class="text-sm text-muted-foreground">{m.address_book_empty()}</p>
        <a
          href={localizeHref("/client/address-book")}
          class="text-sm text-primary underline-offset-4 hover:underline"
        >
          {m.address_book_title()}
        </a>
      </div>
    {/if}

    <!-- Save current address -->
    {#if currentAddress?.trim()}
      <div class="border-t p-2">
        {#if showSaveInput}
          <form
            onsubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            class="flex gap-1"
          >
            <Input
              placeholder={m.address_book_label_placeholder()}
              bind:value={saveLabel}
              class="h-8 text-sm flex-1"
              disabled={saving}
            />
            <Button
              type="submit"
              size="icon"
              class="size-8 shrink-0"
              disabled={saving || !saveLabel.trim()}
            >
              <Save class="size-3.5" />
            </Button>
          </form>
        {:else}
          <button
            type="button"
            class="w-full text-left text-sm text-primary hover:underline underline-offset-4 px-1 py-1"
            onclick={() => (showSaveInput = true)}
          >
            {m.address_book_save_current()}
          </button>
        {/if}
      </div>
    {/if}
  </Popover.Content>
</Popover.Root>
