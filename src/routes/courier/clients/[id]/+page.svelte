<script lang="ts">
  import { goto, preloadData } from "$app/navigation";
  import { page } from "$app/stores";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { localizeHref } from "$lib/paraglide/runtime.js";
  import {
    ArrowLeft,
    Edit,
    MoreVertical,
    Package,
    CheckCircle,
    Clock,
    UserX,
    UserCheck,
    KeyRound,
  } from "@lucide/svelte";
  import type { PageData } from "./$types";

  // Child components
  import ClientInfoTab from "./ClientInfoTab.svelte";
  import ClientServicesTab from "./ClientServicesTab.svelte";
  import ClientBillingTab from "./ClientBillingTab.svelte";
  import ResetPasswordDialog from "./ResetPasswordDialog.svelte";
  import ToggleActiveDialog from "./ToggleActiveDialog.svelte";

  let { data }: { data: PageData } = $props();

  // Dialog state
  let showArchiveDialog = $state(false);
  let showPasswordDialog = $state(false);

  // Handle ?tab=billing query param for direct navigation
  const initialTab = $derived($page.url.searchParams.get("tab") || "info");

  // Derived data from props
  const client = $derived(data.client);
  const services = $derived(data.services);
  const stats = $derived(data.stats);
  const pagination = $derived(data.pagination);
  const pricing = $derived(data.pricing);
  const zones = $derived(data.zones);
  const pricingMode = $derived(data.pricingMode);
  const clientDefaultServiceType = $derived(data.clientDefaultServiceType);
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="sm" href={localizeHref("/courier/clients")}>
        <ArrowLeft class="size-4" />
      </Button>
      <h1 class="text-2xl font-bold">{client.name}</h1>
      {#if !client.active}
        <Badge variant="secondary" class="bg-muted"
          >{m.clients_inactive()}</Badge
        >
      {/if}
    </div>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button variant="outline" size="sm" {...props}>
            <MoreVertical class="size-4" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item
          onmouseenter={() =>
            preloadData(localizeHref(`/courier/clients/${client.id}/edit`))}
          onclick={() =>
            goto(localizeHref(`/courier/clients/${client.id}/edit`))}
        >
          <Edit class="mr-2 size-4" />
          {m.action_edit()}
        </DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => (showPasswordDialog = true)}>
          <KeyRound class="mr-2 size-4" />
          {m.password_reset_client()}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onclick={() => (showArchiveDialog = true)}>
          {#if client.active}
            <UserX class="mr-2 size-4" />
            {m.clients_deactivate()}
          {:else}
            <UserCheck class="mr-2 size-4" />
            {m.clients_reactivate()}
          {/if}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-3 gap-4">
    <Card.Root>
      <Card.Content class="flex items-center gap-3 p-4">
        <Package class="size-8 text-muted-foreground" />
        <div>
          <p class="text-2xl font-bold">{stats.total}</p>
          <p class="text-sm text-muted-foreground">{m.stats_total()}</p>
        </div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="flex items-center gap-3 p-4">
        <Clock class="size-8 text-blue-500" />
        <div>
          <p class="text-2xl font-bold">{stats.pending}</p>
          <p class="text-sm text-muted-foreground">{m.status_pending()}</p>
        </div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="flex items-center gap-3 p-4">
        <CheckCircle class="size-8 text-green-500" />
        <div>
          <p class="text-2xl font-bold">{stats.delivered}</p>
          <p class="text-sm text-muted-foreground">{m.status_delivered()}</p>
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Tabs -->
  <Tabs.Root value={initialTab}>
    <Tabs.List>
      <Tabs.Trigger value="info">{m.tab_info()}</Tabs.Trigger>
      <Tabs.Trigger value="services"
        >{m.tab_services()} ({stats.total})</Tabs.Trigger
      >
      <Tabs.Trigger value="billing">{m.nav_billing()}</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="info" class="pt-4">
      <ClientInfoTab {client} supabase={data.supabase} />
    </Tabs.Content>

    <Tabs.Content value="services" class="pt-4">
      <ClientServicesTab {services} clientId={client.id} {pagination} />
    </Tabs.Content>

    <Tabs.Content value="billing" class="pt-4">
      <ClientBillingTab
        clientId={client.id}
        clientName={client.name}
        supabase={data.supabase}
        {pricingMode}
        {pricing}
        {zones}
        {clientDefaultServiceType}
      />
    </Tabs.Content>
  </Tabs.Root>
</div>

<!-- Dialogs -->
<ToggleActiveDialog bind:open={showArchiveDialog} isActive={client.active} />

<ResetPasswordDialog
  bind:open={showPasswordDialog}
  clientId={client.id}
  supabase={data.supabase}
/>
