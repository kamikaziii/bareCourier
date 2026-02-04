<script lang="ts">
  import { enhance } from "$app/forms";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { localizeHref } from "$lib/paraglide/runtime.js";
  import { formatDate, formatCurrency, formatDistance } from "$lib/utils.js";
  import { Euro, FileText, Calculator, AlertTriangle } from "@lucide/svelte";
  import type {
    ClientPricing,
    PricingZone,
    PricingModel,
    Service,
  } from "$lib/database.types";
  import type { SupabaseClient } from "@supabase/supabase-js";

  let {
    clientId,
    clientName,
    supabase,
    pricingMode,
    pricing,
    zones,
    clientDefaultServiceType,
  }: {
    clientId: string;
    clientName: string;
    supabase: SupabaseClient;
    pricingMode: "warehouse" | "zone" | "type";
    pricing: ClientPricing | null;
    zones: PricingZone[];
    clientDefaultServiceType: {
      id: string;
      name: string;
      price: number;
    } | null;
  } = $props();

  function getPricingModelLabel(model: PricingModel): string {
    switch (model) {
      case "per_km":
        return m.billing_model_per_km();
      case "flat_plus_km":
        return m.billing_model_flat_plus_km();
      case "zone":
        return m.billing_model_zone();
    }
  }

  // Services history state
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let historyStartDate = $state(firstOfMonth.toISOString().split("T")[0]);
  let historyEndDate = $state(lastOfMonth.toISOString().split("T")[0]);
  let historyServices = $state<Service[]>([]);
  let historyLoading = $state(false);
  let historyStats = $state({ services: 0, km: 0, revenue: 0 });
  let recalculating = $state(false);
  let recalculateError = $state("");

  // Only count services that CAN be recalculated (have service_type_id)
  let missingPriceCount = $derived(
    historyServices.filter(
      (s) => s.calculated_price === null && s.service_type_id !== null,
    ).length,
  );

  async function loadServiceHistory() {
    historyLoading = true;

    const endDatePlusOne = new Date(historyEndDate);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

    const { data: servicesData } = await supabase
      .from("services")
      .select("*")
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .gte("created_at", new Date(historyStartDate).toISOString())
      .lt("created_at", endDatePlusOne.toISOString())
      .order("created_at", { ascending: false });

    historyServices = servicesData || [];

    let totalKm = 0;
    let totalRevenue = 0;
    for (const s of historyServices) {
      totalKm += s.distance_km || 0;
      totalRevenue += s.calculated_price || 0;
    }

    historyStats = {
      services: historyServices.length,
      km: Math.round(totalKm * 10) / 10,
      revenue: Math.round(totalRevenue * 100) / 100,
    };

    historyLoading = false;
  }

  function exportClientCSV() {
    const headers = [
      m.reports_table_date(),
      m.form_pickup_location(),
      m.form_delivery_location(),
      m.billing_distance(),
      m.billing_price(),
      m.reports_status(),
    ];

    const rows = historyServices.map((s) => [
      formatDate(s.created_at),
      s.pickup_location,
      s.delivery_location,
      formatDistance(s.distance_km || 0),
      formatCurrency(s.calculated_price || 0),
      s.status === "delivered" ? m.status_delivered() : m.status_pending(),
    ]);

    rows.push(["", "", "", "", "", ""]);
    rows.push([
      m.billing_total(),
      "",
      "",
      formatDistance(historyStats.km),
      formatCurrency(historyStats.revenue),
      "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `billing_${clientName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${historyStartDate}_to_${historyEndDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleRecalculate() {
    recalculating = true;
    recalculateError = "";
    return async ({
      result,
    }: {
      result: { type: string; data?: { success?: boolean; error?: string } };
    }) => {
      recalculating = false;
      if (result.type === "success" && result.data?.success) {
        await loadServiceHistory();
      } else if (
        result.type === "failure" ||
        (result.type === "success" && !result.data?.success)
      ) {
        recalculateError = result.data?.error || m.error_generic();
      }
    };
  }

  $effect(() => {
    if (historyStartDate && historyEndDate) {
      loadServiceHistory();
    }
  });
</script>

<div class="space-y-4">
  {#if pricingMode === "type"}
    <!-- Type-Based Pricing Display -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <Euro class="size-5" />
          {m.billing_pricing_config()}
        </Card.Title>
        <Card.Description>{m.billing_type_based_desc()}</Card.Description>
      </Card.Header>
      <Card.Content>
        <div class="space-y-3 rounded-md bg-muted p-4">
          <div class="flex justify-between">
            <span class="text-muted-foreground">{m.billing_pricing_mode()}</span
            >
            <Badge variant="outline">{m.billing_type_based()}</Badge>
          </div>
          <Separator />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">
                {m.billing_default_service_type()}
              </p>
              {#if clientDefaultServiceType}
                <p class="font-medium">
                  {clientDefaultServiceType.name}
                  <span class="text-muted-foreground">
                    ({formatCurrency(clientDefaultServiceType.price)})
                  </span>
                </p>
              {:else}
                <p class="text-muted-foreground">
                  {m.billing_no_default_type()}
                </p>
              {/if}
            </div>
            <Button
              variant="outline"
              size="sm"
              href={localizeHref(`/courier/clients/${clientId}/edit`)}
            >
              {m.billing_change()}
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {:else}
    <!-- Distance-Based Pricing Display (existing code) -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <Euro class="size-5" />
          {m.billing_pricing_config()}
        </Card.Title>
        <Card.Description>{m.billing_pricing_config_desc()}</Card.Description>
      </Card.Header>
      <Card.Content>
        {#if pricing}
          <div class="mb-4 space-y-2 rounded-md bg-muted p-4">
            <div class="flex justify-between">
              <span class="text-muted-foreground"
                >{m.billing_pricing_model()}</span
              >
              <Badge variant="outline">
                {getPricingModelLabel(pricing.pricing_model as PricingModel)}
              </Badge>
            </div>
            {#if pricing.pricing_model !== "zone"}
              <div class="flex justify-between">
                <span class="text-muted-foreground">{m.billing_base_fee()}</span
                >
                <span>{formatCurrency(pricing.base_fee)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground"
                  >{m.billing_per_km_rate()}</span
                >
                <span>{formatCurrency(pricing.per_km_rate)}/km</span>
              </div>
            {:else if zones.length > 0}
              <Separator class="my-2" />
              <p class="text-sm font-medium">{m.billing_zones()}</p>
              {#each zones as zone (zone.id)}
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">
                    {zone.min_km} - {zone.max_km !== null
                      ? `${zone.max_km} km`
                      : "..."}
                  </span>
                  <span>{formatCurrency(zone.price)}</span>
                </div>
              {/each}
            {/if}
          </div>
        {:else}
          <p class="mb-4 text-muted-foreground">
            {m.billing_not_configured()}
          </p>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Link to edit pricing in billing (only for distance-based) -->
    <Button href={localizeHref(`/courier/billing/${clientId}`)}>
      <Euro class="size-4 mr-2" />
      {m.billing_client_detail()}
    </Button>
  {/if}

  <!-- Services History Section -->
  <Separator class="my-6" />

  <div class="space-y-4">
    <div
      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <h3 class="text-lg font-semibold">{m.billing_services_history()}</h3>
      <div class="flex flex-wrap gap-2">
        {#if pricingMode === "type" && missingPriceCount > 0}
          <form
            method="POST"
            action="?/recalculateMissing"
            use:enhance={handleRecalculate}
          >
            <input type="hidden" name="startDate" value={historyStartDate} />
            <input type="hidden" name="endDate" value={historyEndDate} />
            <Button
              variant="outline"
              size="sm"
              type="submit"
              disabled={recalculating}
            >
              <Calculator class="mr-2 size-4" />
              {m.billing_recalculate_missing()} ({missingPriceCount})
            </Button>
          </form>
        {/if}
        {#if pricingMode === "type"}
          <form
            method="POST"
            action="?/recalculateAll"
            use:enhance={handleRecalculate}
          >
            <input type="hidden" name="startDate" value={historyStartDate} />
            <input type="hidden" name="endDate" value={historyEndDate} />
            <Button
              variant="outline"
              size="sm"
              type="submit"
              disabled={recalculating || historyServices.length === 0}
            >
              <Calculator class="mr-2 size-4" />
              {m.billing_recalculate_all()}
            </Button>
          </form>
        {/if}
        <Button
          variant="outline"
          size="sm"
          onclick={exportClientCSV}
          disabled={historyServices.length === 0}
        >
          <FileText class="mr-2 size-4" />
          {m.billing_export_csv()}
        </Button>
      </div>
    </div>

    {#if recalculateError}
      <div
        class="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <AlertTriangle class="size-4 shrink-0" />
        <span>{recalculateError}</span>
      </div>
    {/if}

    {#if pricingMode === "type" && missingPriceCount > 0}
      <div
        class="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400"
      >
        <AlertTriangle class="size-4 shrink-0" />
        <span>{m.billing_missing_price_warning()}</span>
      </div>
    {/if}

    <!-- Date Range -->
    <Card.Root>
      <Card.Content class="pt-6">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <Label for="history_start">{m.reports_start_date()}</Label>
            <Input
              id="history_start"
              type="date"
              bind:value={historyStartDate}
            />
          </div>
          <div class="space-y-2">
            <Label for="history_end">{m.reports_end_date()}</Label>
            <Input id="history_end" type="date" bind:value={historyEndDate} />
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Summary Stats -->
    <div class="grid gap-4 md:grid-cols-3">
      <Card.Root>
        <Card.Content class="p-4 text-center">
          <p class="text-2xl font-bold">{historyStats.services}</p>
          <p class="text-sm text-muted-foreground">
            {m.billing_services()}
          </p>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Content class="p-4 text-center">
          <p class="text-2xl font-bold">
            {formatDistance(historyStats.km)} km
          </p>
          <p class="text-sm text-muted-foreground">
            {m.billing_total_km()}
          </p>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Content class="p-4 text-center">
          <p class="text-2xl font-bold">
            {formatCurrency(historyStats.revenue)}
          </p>
          <p class="text-sm text-muted-foreground">
            {m.billing_estimated_cost()}
          </p>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Services Table -->
    <Card.Root>
      <Card.Content class="p-0">
        {#if historyLoading}
          <p class="py-8 text-center text-muted-foreground">
            {m.loading()}
          </p>
        {:else if historyServices.length === 0}
          <p class="py-8 text-center text-muted-foreground">
            {m.billing_no_services()}
          </p>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b bg-muted/50">
                  <th class="px-4 py-3 text-left text-sm font-medium">
                    {m.reports_table_date()}
                  </th>
                  <th class="px-4 py-3 text-left text-sm font-medium">
                    {m.reports_table_route()}
                  </th>
                  <th class="px-4 py-3 text-right text-sm font-medium">
                    {m.billing_distance()}
                  </th>
                  <th class="px-4 py-3 text-right text-sm font-medium">
                    {m.billing_price()}
                  </th>
                  <th class="px-4 py-3 text-center text-sm font-medium">
                    {m.reports_status()}
                  </th>
                </tr>
              </thead>
              <tbody>
                {#each historyServices as service (service.id)}
                  <tr class="border-b">
                    <td class="px-4 py-3 text-sm">
                      {formatDate(service.created_at)}
                    </td>
                    <td
                      class="px-4 py-3 text-sm text-muted-foreground truncate max-w-xs"
                    >
                      {service.pickup_location} ... {service.delivery_location}
                    </td>
                    <td class="px-4 py-3 text-right text-sm">
                      {formatDistance(service.distance_km || 0)} km
                    </td>
                    <td class="px-4 py-3 text-right text-sm font-medium">
                      {formatCurrency(service.calculated_price || 0)}
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span
                        class="rounded-full px-2 py-0.5 text-xs font-medium {service.status ===
                        'pending'
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-green-500/10 text-green-500'}"
                      >
                        {service.status === "pending"
                          ? m.status_pending()
                          : m.status_delivered()}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</div>
