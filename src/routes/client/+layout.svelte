<script lang="ts">
  import AppShell from "$lib/components/AppShell.svelte";
  import * as m from "$lib/paraglide/messages.js";
  import type { LayoutData } from "./$types";
  import type { Snippet } from "svelte";
  import {
    Package,
    PlusCircle,
    Calendar,
    BookUser,
    Receipt,
    Settings,
  } from "@lucide/svelte";
  import type { NavItem } from "$lib/types/navigation.js";

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  const allNavItems: NavItem[] = $derived([
    {
      href: "/client",
      label: m.nav_my_services(),
      icon: Package,
      badge: data.navCounts?.suggestedServices,
    },
    { href: "/client/new", label: m.nav_new_request(), icon: PlusCircle },
    { href: "/client/calendar", label: m.nav_calendar(), icon: Calendar },
    { href: "/client/billing", label: m.nav_billing(), icon: Receipt },
    {
      href: "/client/address-book",
      label: m.nav_address_book(),
      icon: BookUser,
    },
    { href: "/client/settings", label: m.nav_settings(), icon: Settings },
  ]);

  const bottomNavItems = $derived(allNavItems.slice(0, 4));

  const moreItems = $derived(allNavItems.slice(4));
</script>

<AppShell
  profile={data.profile}
  role="client"
  supabase={data.supabase}
  sidebarItems={allNavItems}
  {bottomNavItems}
  {moreItems}
  sidebarCollapsed={data.sidebarCollapsed}
>
  {@render children()}
</AppShell>
