<script lang="ts">
  import { goto } from "$app/navigation";
  import { onDestroy } from "svelte";
  import { PUBLIC_SUPABASE_URL } from "$env/static/public";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import AddressInput from "$lib/components/AddressInput.svelte";
  import PricingConfigForm from "$lib/components/PricingConfigForm.svelte";
  import * as m from "$lib/paraglide/messages.js";
  import { formatCurrency } from "$lib/utils.js";
  import { localizeHref } from "$lib/paraglide/runtime.js";
  import type { PageData } from "./$types";
  import type { PricingModel } from "$lib/database.types.js";
  import {
    ArrowLeft,
    Package,
    Euro,
    ChevronDown,
    AlertTriangle,
  } from "@lucide/svelte";

  let { data }: { data: PageData } = $props();

  let loading = $state(false);
  let error = $state("");
  let success = $state("");
  let warning = $state("");
  let name = $state("");
  let email = $state("");
  let password = $state("");
  let phone = $state("");
  let defaultPickupLocation = $state("");
  let defaultPickupCoords = $state<[number, number] | null>(null);
  let defaultServiceTypeId = $state("");
  let redirectTimeout: ReturnType<typeof setTimeout> | null = null;

  // Pricing section
  let showPricingSection = $state(false);
  let pendingPricingConfig: {
    pricing_model: PricingModel;
    base_fee: number;
    per_km_rate: number;
  } | null = $state(null);
  let pendingPricingZones: {
    min_km: number;
    max_km: number | null;
    price: number;
  }[] = $state([]);

  // Clean up redirect timeout on unmount
  onDestroy(() => {
    if (redirectTimeout) {
      clearTimeout(redirectTimeout);
    }
  });

  function handleAddressSelect(
    address: string,
    coords: [number, number] | null,
  ) {
    defaultPickupLocation = address;
    defaultPickupCoords = coords;
  }

  // Clear coordinates when address is emptied (handles case where user clears the field)
  $effect(() => {
    if (!defaultPickupLocation) {
      defaultPickupCoords = null;
    }
  });

  function handlePricingChange(
    config: {
      pricing_model: PricingModel;
      base_fee: number;
      per_km_rate: number;
    },
    zones: { min_km: number; max_km: number | null; price: number }[],
  ) {
    pendingPricingConfig = config;
    pendingPricingZones = zones;
    return Promise.resolve();
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    error = "";

    // Get session token for edge function auth
    const { data: sessionData } = await data.supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      error = m.session_expired();
      loading = false;
      return;
    }

    // Call edge function to create client (uses admin API, no confirmation email)
    const response = await fetch(
      `${PUBLIC_SUPABASE_URL}/functions/v1/create-client`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
          phone: phone.trim() || null,
          default_pickup_location: defaultPickupLocation.trim() || null,
          default_pickup_lat: defaultPickupCoords?.[1] ?? null,
          default_pickup_lng: defaultPickupCoords?.[0] ?? null,
          default_service_type_id: defaultServiceTypeId || null,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      error = result.error || m.error_create_client_failed();
      loading = false;
      return;
    }

    // If pricing config was set, save it for the new client
    let pricingSaveFailed = false;
    if (pendingPricingConfig && result.user?.id) {
      try {
        // Save pricing configuration
        const { error: pricingError } = await data.supabase
          .from("client_pricing")
          .upsert(
            {
              client_id: result.user.id,
              pricing_model: pendingPricingConfig.pricing_model,
              base_fee: pendingPricingConfig.base_fee,
              per_km_rate: pendingPricingConfig.per_km_rate,
            },
            { onConflict: "client_id" },
          );

        if (pricingError) {
          console.error("Pricing save error:", pricingError);
          pricingSaveFailed = true;
        }

        // If zone pricing, save zones
        if (
          pendingPricingConfig.pricing_model === "zone" &&
          pendingPricingZones.length > 0
        ) {
          const { error: zonesError } = await data.supabase.rpc(
            "replace_pricing_zones",
            {
              p_client_id: result.user.id,
              p_zones: pendingPricingZones,
            },
          );

          if (zonesError) {
            console.error("Zones save error:", zonesError);
            pricingSaveFailed = true;
          }
        }
      } catch (err) {
        console.error("Failed to save pricing:", err);
        pricingSaveFailed = true;
      }
    }

    // Success - show message briefly then redirect
    if (pricingSaveFailed) {
      success = m.clients_success();
      warning =
        "Client created, but pricing configuration failed to save. You can add it later.";
    } else {
      success = m.clients_success();
    }
    loading = false;

    redirectTimeout = setTimeout(
      () => {
        goto(localizeHref("/courier/clients"));
      },
      pricingSaveFailed ? 3000 : 1500,
    );
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <Button variant="ghost" size="sm" href={localizeHref("/courier/clients")}>
      <ArrowLeft class="size-4" />
    </Button>
    <h1 class="text-2xl font-bold">{m.new_client()}</h1>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>{m.client_info()}</Card.Title>
      <Card.Description>{m.new_client_desc()}</Card.Description>
    </Card.Header>
    <Card.Content>
      <form onsubmit={handleSubmit} class="space-y-4">
        {#if error}
          <div
            class="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        {/if}
        {#if success}
          <div class="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
            {success}
          </div>
        {/if}
        {#if warning}
          <div
            class="rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 flex items-start gap-2"
          >
            <AlertTriangle class="size-4 mt-0.5 flex-shrink-0" />
            <span>{warning}</span>
          </div>
        {/if}

        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <Label for="email">{m.auth_email()} *</Label>
            <Input
              id="email"
              type="email"
              bind:value={email}
              required
              disabled={loading}
            />
          </div>
          <div class="space-y-2">
            <Label for="password">{m.auth_password()} *</Label>
            <Input
              id="password"
              type="password"
              bind:value={password}
              required
              disabled={loading}
              minlength={6}
            />
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <Label for="name">{m.form_name()} *</Label>
            <Input
              id="name"
              type="text"
              bind:value={name}
              required
              disabled={loading}
            />
          </div>
          <div class="space-y-2">
            <Label for="phone">{m.form_phone()}</Label>
            <Input
              id="phone"
              type="tel"
              bind:value={phone}
              disabled={loading}
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label for="location">{m.clients_default_location()}</Label>
          <AddressInput
            id="location"
            bind:value={defaultPickupLocation}
            onSelect={handleAddressSelect}
            placeholder={m.form_pickup_placeholder()}
            disabled={loading}
            showHint={false}
          />
        </div>

        {#if data.pricingMode === "type" && data.serviceTypes.length > 0}
          <div class="space-y-2">
            <Label for="default_service_type_id">
              <span class="flex items-center gap-2">
                <Package class="size-4 text-muted-foreground" />
                {m.default_service_type()}
              </span>
            </Label>
            <select
              id="default_service_type_id"
              bind:value={defaultServiceTypeId}
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              disabled={loading}
            >
              <option value="">{m.none()}</option>
              {#each data.serviceTypes as type (type.id)}
                <option value={type.id}
                  >{type.name} - {formatCurrency(Number(type.price))}</option
                >
              {/each}
            </select>
            <p class="text-xs text-muted-foreground">
              {m.default_service_type_desc()}
            </p>
          </div>
        {/if}

        {#if data.pricingMode !== "type"}
          <!-- Pricing Configuration (Collapsible) - Only for distance-based pricing -->
          <Separator />

          <div class="space-y-4">
            <button
              type="button"
              class="flex w-full items-center justify-between text-left"
              onclick={() => (showPricingSection = !showPricingSection)}
              disabled={loading}
            >
              <div class="flex items-center gap-2">
                <Euro class="size-5 text-muted-foreground" />
                <span class="font-medium">{m.billing_pricing_config()}</span>
                <Badge variant="secondary">{m.schedule_optional()}</Badge>
              </div>
              <ChevronDown
                class="size-5 text-muted-foreground transition-transform {showPricingSection
                  ? 'rotate-180'
                  : ''}"
              />
            </button>

            {#if showPricingSection}
              <div class="rounded-md border p-4">
                <p class="mb-4 text-sm text-muted-foreground">
                  {m.billing_pricing_config_desc()}
                </p>
                <PricingConfigForm
                  onSave={handlePricingChange}
                  compact={true}
                />
                {#if pendingPricingConfig}
                  <p class="mt-2 text-xs text-green-600">
                    {m.billing_configured()}
                  </p>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        <div class="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={loading ||
              !name.trim() ||
              !email.trim() ||
              !password ||
              password.length < 6}
          >
            {loading ? m.clients_creating() : m.clients_create()}
          </Button>
          <Button
            type="button"
            variant="outline"
            href={localizeHref("/courier/clients")}
            disabled={loading}
          >
            {m.action_cancel()}
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</div>
