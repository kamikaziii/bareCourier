<script lang="ts">
  import { enhance, applyAction } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { toast } from "$lib/utils/toast.js";
  import AddressInput from "$lib/components/AddressInput.svelte";
  import PasswordChangeForm from "$lib/components/PasswordChangeForm.svelte";
  import { User, Warehouse, Tag } from "@lucide/svelte";
  import type { Profile } from "$lib/database.types.js";
  import type { SafeSession } from "$lib/utils.js";
  import type { SupabaseClient } from "@supabase/supabase-js";
  import type { Database } from "$lib/database.types.js";

  interface Props {
    profile: Profile;
    session: SafeSession;
    supabase: SupabaseClient<Database>;
  }

  let { profile, session, supabase }: Props = $props();

  // Local state for form inputs (mutable, user can edit)
  // svelte-ignore state_referenced_locally
  let warehouseAddress = $state(profile.default_pickup_location || "");
  // svelte-ignore state_referenced_locally
  let warehouseCoords = $state<[number, number] | null>(
    profile.warehouse_lat && profile.warehouse_lng
      ? [profile.warehouse_lng, profile.warehouse_lat]
      : null,
  );
  // svelte-ignore state_referenced_locally
  let labelBusinessName = $state(profile.label_business_name || "");
  // svelte-ignore state_referenced_locally
  let labelTagline = $state(profile.label_tagline || "");

  // Sync local state when profile data changes from server (after form submission + invalidateAll).
  // Uses $derived snapshots to detect actual server-side changes without circular overwrites.
  let prevPickup = $state(profile.default_pickup_location);
  let prevLat = $state(profile.warehouse_lat);
  let prevLng = $state(profile.warehouse_lng);
  let prevBizName = $state(profile.label_business_name);
  let prevTagline = $state(profile.label_tagline);

  $effect(() => {
    if (
      profile.default_pickup_location !== prevPickup ||
      profile.warehouse_lat !== prevLat ||
      profile.warehouse_lng !== prevLng ||
      profile.label_business_name !== prevBizName ||
      profile.label_tagline !== prevTagline
    ) {
      warehouseAddress = profile.default_pickup_location || "";
      warehouseCoords =
        profile.warehouse_lat && profile.warehouse_lng
          ? [profile.warehouse_lng, profile.warehouse_lat]
          : null;
      labelBusinessName = profile.label_business_name || "";
      labelTagline = profile.label_tagline || "";
      prevPickup = profile.default_pickup_location;
      prevLat = profile.warehouse_lat;
      prevLng = profile.warehouse_lng;
      prevBizName = profile.label_business_name;
      prevTagline = profile.label_tagline;
    }
  });
</script>

<!-- Profile Settings -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <User class="size-5" />
      {m.settings_profile()}
    </Card.Title>
    <Card.Description>{m.settings_profile_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form
      method="POST"
      action="?/updateProfile"
      use:enhance={async () => {
        return async ({ result }) => {
          await applyAction(result);
          if (result.type === "success") {
            await invalidateAll();
            toast.success(m.toast_profile_updated());
          } else if (result.type === "failure") {
            toast.error(m.toast_settings_failed(), { duration: 8000 });
          }
        };
      }}
      class="space-y-4"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <Label for="name">{m.form_name()}</Label>
          <Input id="name" name="name" value={profile.name} required />
        </div>
        <div class="space-y-2">
          <Label for="phone">{m.form_phone()}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            value={profile.phone || ""}
          />
        </div>
      </div>
      <div class="space-y-2">
        <Label>{m.auth_email()}</Label>
        <Input disabled value={session?.user?.email || ""} />
        <p class="text-xs text-muted-foreground">
          {m.settings_email_readonly()}
        </p>
      </div>
      <Button type="submit">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>

<!-- Default Location -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Warehouse class="size-5" />
      {m.settings_default_location()}
    </Card.Title>
    <Card.Description
      >{m.settings_courier_default_location_desc()}</Card.Description
    >
  </Card.Header>
  <Card.Content>
    <form
      method="POST"
      action="?/updateWarehouseLocation"
      use:enhance={async () => {
        return async ({ result }) => {
          await applyAction(result);
          if (result.type === "success") {
            await invalidateAll();
            toast.success(m.toast_settings_saved());
          } else if (result.type === "failure") {
            toast.error(m.toast_settings_failed(), { duration: 8000 });
          }
        };
      }}
      class="space-y-4"
    >
      <div class="space-y-2">
        <Label for="default_pickup_location"
          >{m.settings_warehouse_address()}</Label
        >
        <AddressInput
          id="default_pickup_location"
          bind:value={warehouseAddress}
          onSelect={(address, coords) => {
            warehouseAddress = address;
            warehouseCoords = coords;
          }}
          placeholder={m.form_warehouse_placeholder()}
        />
        {#if warehouseCoords}
          <p class="text-xs text-green-600">{m.address_verified()}</p>
        {:else if warehouseAddress}
          <p class="text-xs text-orange-600">
            {m.settings_warehouse_select_hint()}
          </p>
        {:else}
          <p class="text-xs text-muted-foreground">
            {m.settings_warehouse_hint()}
          </p>
        {/if}
        <input
          type="hidden"
          name="default_pickup_location"
          value={warehouseAddress}
        />
        <input
          type="hidden"
          name="warehouse_lat"
          value={warehouseCoords?.[1] ?? ""}
        />
        <input
          type="hidden"
          name="warehouse_lng"
          value={warehouseCoords?.[0] ?? ""}
        />
      </div>
      <Button type="submit">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>

<!-- Label Branding -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Tag class="size-5" />
      {m.label_branding()}
    </Card.Title>
    <Card.Description>{m.label_branding_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form
      method="POST"
      action="?/updateLabelBranding"
      use:enhance={async () => {
        return async ({ result }) => {
          await applyAction(result);
          if (result.type === "success") {
            await invalidateAll();
            toast.success(m.toast_settings_saved());
          } else if (result.type === "failure") {
            toast.error(m.toast_settings_failed(), { duration: 8000 });
          }
        };
      }}
      class="space-y-4"
    >
      <div class="space-y-2">
        <Label for="label_business_name">{m.label_business_name()}</Label>
        <Input
          id="label_business_name"
          name="label_business_name"
          bind:value={labelBusinessName}
          placeholder={m.label_business_name_placeholder()}
        />
      </div>
      <div class="space-y-2">
        <Label for="label_tagline">{m.label_tagline()}</Label>
        <Input
          id="label_tagline"
          name="label_tagline"
          bind:value={labelTagline}
          placeholder={m.label_tagline_placeholder()}
        />
        <p class="text-xs text-muted-foreground">{m.label_tagline_help()}</p>
      </div>
      <Button type="submit">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>

<!-- Password Change -->
<PasswordChangeForm {supabase} userEmail={session?.user?.email || ""} />
