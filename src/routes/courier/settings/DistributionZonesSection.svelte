<script lang="ts">
  import { enhance, applyAction } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { SvelteSet } from "svelte/reactivity";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Collapsible from "$lib/components/ui/collapsible/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { MapPin, Search, ChevronDown, ChevronRight } from "@lucide/svelte";
  import { PORTUGAL_DISTRITOS } from "$lib/data/portugal-municipalities.js";
  import type { DistributionZone } from "$lib/database.types.js";
  import * as m from "$lib/paraglide/messages.js";
  import { toast } from "$lib/utils/toast.js";

  interface Props {
    distributionZones: DistributionZone[];
  }

  let { distributionZones }: Props = $props();

  // Search filter state
  let searchQuery = $state("");

  // Track expanded districts - using SvelteSet for proper reactivity
  let expandedDistricts = new SvelteSet<string>();

  // Track selected zones as "distrito|concelho" keys
  // Initialize from props - this is intentionally local state that the user modifies
  // We don't want it to reset when the parent re-renders after save
  // svelte-ignore state_referenced_locally
  let selectedZones = new SvelteSet<string>(
    distributionZones.map((z) => `${z.distrito}|${z.concelho}`),
  );

  // Loading state for form submission
  let saving = $state(false);

  // Create a key for a zone
  function zoneKey(distrito: string, concelho: string): string {
    return `${distrito}|${concelho}`;
  }

  // Check if a zone is selected
  function isZoneSelected(distrito: string, concelho: string): boolean {
    return selectedZones.has(zoneKey(distrito, concelho));
  }

  // Toggle a single zone
  function toggleZone(distrito: string, concelho: string) {
    const key = zoneKey(distrito, concelho);
    if (selectedZones.has(key)) {
      selectedZones.delete(key);
    } else {
      selectedZones.add(key);
    }
    // SvelteSet handles reactivity automatically
  }

  // Toggle all zones in a district
  function toggleDistrictZones(distrito: string, concelhos: string[]) {
    const allSelected = concelhos.every((c) => isZoneSelected(distrito, c));

    if (allSelected) {
      // Deselect all
      for (const concelho of concelhos) {
        selectedZones.delete(zoneKey(distrito, concelho));
      }
    } else {
      // Select all
      for (const concelho of concelhos) {
        selectedZones.add(zoneKey(distrito, concelho));
      }
    }
    // SvelteSet handles reactivity automatically
  }

  // Check if all municipalities in a district are selected
  function isDistrictFullySelected(
    distrito: string,
    concelhos: string[],
  ): boolean {
    return concelhos.every((c) => isZoneSelected(distrito, c));
  }

  // Check if some but not all municipalities in a district are selected
  function isDistrictPartiallySelected(
    distrito: string,
    concelhos: string[],
  ): boolean {
    const selected = concelhos.filter((c) => isZoneSelected(distrito, c));
    return selected.length > 0 && selected.length < concelhos.length;
  }

  // Toggle district expansion
  function toggleDistrictExpansion(distrito: string) {
    if (expandedDistricts.has(distrito)) {
      expandedDistricts.delete(distrito);
    } else {
      expandedDistricts.add(distrito);
    }
    // SvelteSet handles reactivity automatically
  }

  // Filter districts and municipalities by search
  const filteredDistritos = $derived.by(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return PORTUGAL_DISTRITOS;

    return PORTUGAL_DISTRITOS.map((d) => ({
      ...d,
      concelhos: d.concelhos.filter(
        (c) =>
          c.toLowerCase().includes(query) ||
          d.distrito.toLowerCase().includes(query),
      ),
    })).filter((d) => d.concelhos.length > 0);
  });

  // Count selected zones
  const selectedCount = $derived(selectedZones.size);

  // Convert selected zones to JSON for form submission
  const zonesJson = $derived.by(() => {
    return JSON.stringify(
      Array.from(selectedZones).map((key) => {
        const [distrito, concelho] = key.split("|");
        return { distrito, concelho };
      }),
    );
  });

  // Expand all districts (useful when searching)
  function expandAll() {
    expandedDistricts.clear();
    for (const d of PORTUGAL_DISTRITOS) {
      expandedDistricts.add(d.distrito);
    }
  }

  // Collapse all districts
  function collapseAll() {
    expandedDistricts.clear();
  }

  // Track previous search to detect changes
  let previousSearch = "";

  // When search query changes, auto-expand matching districts
  $effect(() => {
    const currentSearch = searchQuery.trim();
    if (currentSearch && currentSearch !== previousSearch) {
      // Auto-expand matching districts when search changes
      expandedDistricts.clear();
      for (const d of filteredDistritos) {
        expandedDistricts.add(d.distrito);
      }
    }
    previousSearch = currentSearch;
  });
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <MapPin class="size-5" />
      {m.distribution_zones()}
    </Card.Title>
    <Card.Description>
      {m.distribution_zones_desc()}
    </Card.Description>
  </Card.Header>
  <Card.Content class="space-y-4">
    <!-- Search input -->
    <div class="relative">
      <Search
        class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="text"
        placeholder={m.search_placeholder()}
        bind:value={searchQuery}
        class="pl-10"
      />
    </div>

    <!-- Expand/Collapse controls -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
          onclick={expandAll}
        >
          {m.expand_all()}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
          onclick={collapseAll}
        >
          {m.collapse_all()}
        </Button>
      </div>
      <Badge variant="secondary" class="text-xs sm:text-sm">
        {selectedCount}
        {m.selected_count()}
      </Badge>
    </div>

    <!-- Scrollable list of districts -->
    <div class="max-h-96 space-y-2 overflow-y-auto rounded-lg border p-2">
      {#if filteredDistritos.length === 0}
        <div class="py-8 text-center text-sm text-muted-foreground">
          {m.no_results()}
        </div>
      {:else}
        {#each filteredDistritos as district (district.distrito)}
          {@const isExpanded = expandedDistricts.has(district.distrito)}
          {@const isFullySelected = isDistrictFullySelected(
            district.distrito,
            district.concelhos,
          )}
          {@const isPartiallySelected = isDistrictPartiallySelected(
            district.distrito,
            district.concelhos,
          )}

          <Collapsible.Root
            open={isExpanded}
            onOpenChange={() => toggleDistrictExpansion(district.distrito)}
          >
            <div
              class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <!-- District checkbox (select all) -->
              <Checkbox
                checked={isFullySelected}
                indeterminate={isPartiallySelected}
                onCheckedChange={() =>
                  toggleDistrictZones(district.distrito, district.concelhos)}
                aria-label="{m.select_all()} {district.distrito}"
              />

              <!-- Expand/collapse trigger -->
              <Collapsible.Trigger
                class="flex flex-1 items-center gap-2 text-left"
              >
                <span class="font-medium">{district.distrito}</span>
                <span class="text-xs text-muted-foreground">
                  ({district.concelhos.filter((c) =>
                    isZoneSelected(district.distrito, c),
                  ).length}/{district.concelhos.length})
                </span>
                <span class="ml-auto">
                  {#if isExpanded}
                    <ChevronDown class="size-4" />
                  {:else}
                    <ChevronRight class="size-4" />
                  {/if}
                </span>
              </Collapsible.Trigger>
            </div>

            <Collapsible.Content>
              <div
                class="ml-6 mt-1 grid gap-1 border-l pl-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {#each district.concelhos as concelho (concelho)}
                  {@const isSelected = isZoneSelected(
                    district.distrito,
                    concelho,
                  )}
                  <Label
                    class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() =>
                        toggleZone(district.distrito, concelho)}
                    />
                    <span class="text-sm">{concelho}</span>
                  </Label>
                {/each}
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        {/each}
      {/if}
    </div>

    <!-- Save form -->
    <form
      method="POST"
      action="?/saveDistributionZones"
      use:enhance={async () => {
        saving = true;
        return async ({ result }) => {
          saving = false;
          await applyAction(result);
          if (result.type === "success") {
            await invalidateAll();
            toast.success(m.toast_zones_saved());
          }
        };
      }}
    >
      <input type="hidden" name="zones" value={zonesJson} />
      <div class="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? m.saving() : m.action_save()}
        </Button>
      </div>
    </form>
  </Card.Content>
</Card.Root>
