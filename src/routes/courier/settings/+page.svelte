<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import AccountTab from "./AccountTab.svelte";
  import PricingTab from "./PricingTab.svelte";
  import SchedulingTab from "./SchedulingTab.svelte";
  import NotificationsTab from "$lib/components/NotificationsTab.svelte";
  // Debug tab archived - re-import to enable: import PushDebugTab from './PushDebugTab.svelte';
  import ServiceTypesSection from "./ServiceTypesSection.svelte";
  import DistributionZonesSection from "./DistributionZonesSection.svelte";
  import { Settings } from "@lucide/svelte";
  import * as m from "$lib/paraglide/messages.js";
  import type { PageData, ActionData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const activeTab = $derived(page.url.searchParams.get("tab") || "account");

  /** Map server error codes to localized messages */
  const errorMessageMap: Record<string, () => string> = {
    urgency_in_use: m.settings_urgency_in_use,
    service_type_in_use: m.service_type_in_use,
    service_type_assigned_to_clients: m.service_type_assigned_to_clients,
    "Not authenticated": m.error_not_authenticated,
    "Invalid notification preferences": m.error_invalid_notification_prefs,
    "No data to update": m.error_no_data_to_update,
    "Invalid pricing mode": m.error_invalid_pricing_mode,
    "VAT rate must be between 0 and 100": m.error_invalid_vat_rate,
    "Name is required": m.error_name_required,
    "Invalid ID format": m.error_invalid_id,
    "Invalid timezone": m.error_invalid_timezone,
    "Invalid zones data": m.error_invalid_zones_data,
  };

  function localizedError(error: string): string {
    const mapped = errorMessageMap[error];
    if (mapped) return mapped();
    // Catch known patterns
    if (error.startsWith("Invalid time range"))
      return m.error_invalid_time_range();
    if (error.startsWith("Invalid working days"))
      return m.error_invalid_working_days();
    if (error.startsWith("Failed to")) return m.error_save_failed();
    // Fallback
    return m.error_generic();
  }

  function setTab(tab: string) {
    const url = new URL(page.url);
    if (tab === "account") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    goto(url.toString(), {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-2">
    <Settings class="size-6" />
    <h1 class="text-2xl font-bold">{m.settings_title()}</h1>
  </div>

  {#if form?.error}
    <div class="rounded-md bg-destructive/10 p-3 text-destructive">
      {localizedError(form.error)}
    </div>
  {/if}

  <!-- Desktop: Tabs -->
  <div class="hidden md:block">
    <Tabs.Root value={activeTab} onValueChange={setTab} class="w-full">
      <Tabs.List class="grid w-full grid-cols-4">
        <Tabs.Trigger value="account">{m.settings_tab_account()}</Tabs.Trigger>
        <Tabs.Trigger value="pricing">{m.settings_tab_pricing()}</Tabs.Trigger>
        <Tabs.Trigger value="scheduling"
          >{m.settings_tab_scheduling()}</Tabs.Trigger
        >
        <Tabs.Trigger value="notifications"
          >{m.settings_tab_notifications()}</Tabs.Trigger
        >
      </Tabs.List>

      <Tabs.Content value="account" class="mt-6 space-y-6">
        <AccountTab
          profile={data.profile}
          session={data.session}
          supabase={data.supabase}
        />
      </Tabs.Content>

      <Tabs.Content value="pricing" class="mt-6 space-y-6">
        <PricingTab profile={data.profile} urgencyFees={data.urgencyFees} />
        {#if data.profile.pricing_mode === "type"}
          <ServiceTypesSection serviceTypes={data.serviceTypes} />
          <DistributionZonesSection
            distributionZones={data.distributionZones}
          />
        {/if}
      </Tabs.Content>

      <Tabs.Content value="scheduling" class="mt-6 space-y-6">
        <SchedulingTab profile={data.profile} />
      </Tabs.Content>

      <Tabs.Content value="notifications" class="mt-6 space-y-6">
        <NotificationsTab
          profile={data.profile}
          supabase={data.supabase}
          role="courier"
        />
      </Tabs.Content>
    </Tabs.Root>
  </div>

  <!-- Mobile: Dropdown -->
  <div class="md:hidden space-y-6">
    <select
      value={activeTab}
      onchange={(e) => setTab(e.currentTarget.value)}
      class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
    >
      <option value="account">{m.settings_tab_account()}</option>
      <option value="pricing">{m.settings_tab_pricing()}</option>
      <option value="scheduling">{m.settings_tab_scheduling()}</option>
      <option value="notifications">{m.settings_tab_notifications()}</option>
    </select>

    {#if activeTab === "account"}
      <AccountTab
        profile={data.profile}
        session={data.session}
        supabase={data.supabase}
      />
    {:else if activeTab === "pricing"}
      <PricingTab profile={data.profile} urgencyFees={data.urgencyFees} />
      {#if data.profile.pricing_mode === "type"}
        <ServiceTypesSection serviceTypes={data.serviceTypes} />
        <DistributionZonesSection distributionZones={data.distributionZones} />
      {/if}
    {:else if activeTab === "scheduling"}
      <SchedulingTab profile={data.profile} />
    {:else if activeTab === "notifications"}
      <NotificationsTab
        profile={data.profile}
        supabase={data.supabase}
        role="courier"
      />
    {/if}
  </div>
</div>
