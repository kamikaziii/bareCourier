<script lang="ts">
	import type { Component } from 'svelte';
	import { localizeHref } from '$lib/paraglide/runtime.js';

	interface SidebarItemProps {
		href: string;
		label: string;
		icon: Component;
		isActive: boolean;
		collapsed: boolean;
	}

	let { href, label, icon: Icon, isActive, collapsed }: SidebarItemProps = $props();
</script>

<a
	{href}
	class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
		{isActive
		? 'bg-accent text-accent-foreground'
		: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}
		{collapsed ? 'justify-center' : ''}"
	title={collapsed ? label : undefined}
>
	<Icon class="size-5 shrink-0" />
	{#if !collapsed}
		<span class="truncate">{label}</span>
	{/if}
</a>
