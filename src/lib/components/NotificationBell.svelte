<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { Notification } from '$lib/database.types';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { Bell, CheckCheck, Package, Clock, CalendarClock, Settings, AlertTriangle, BarChart3, X } from '@lucide/svelte';
	import { formatBadge, formatRelativeTime } from '$lib/utils.js';
	import { fly } from 'svelte/transition';

	let {
		supabase,
		userId,
		userRole = 'client'
	}: {
		supabase: SupabaseClient;
		userId: string;
		userRole?: 'courier' | 'client';
	} = $props();

	let notifications = $state<Notification[]>([]);
	let loading = $state(true);
	let open = $state(false);

	type TabFilter = 'all' | 'requests' | 'alerts';
	let activeTab = $state<TabFilter>('all');
	let showUnreadOnly = $state(false);

	const unreadCount = $derived(notifications.filter((n) => !n.read).length);

	const filteredNotifications = $derived.by(() => {
		let filtered = notifications;

		if (activeTab === 'requests') {
			filtered = filtered.filter((n) => ['new_request', 'schedule_change'].includes(n.type));
		} else if (activeTab === 'alerts') {
			filtered = filtered.filter((n) => ['past_due', 'service_status', 'daily_summary'].includes(n.type));
		}

		if (showUnreadOnly) {
			filtered = filtered.filter((n) => !n.read);
		}

		return filtered;
	});

	const groupedNotifications = $derived.by(() => {
		const today: Notification[] = [];
		const earlier: Notification[] = [];
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		for (const n of filteredNotifications) {
			if (new Date(n.created_at || '') >= todayStart) {
				today.push(n);
			} else {
				earlier.push(n);
			}
		}

		return { today, earlier };
	});

	async function markAsRead(id: string) {
		await supabase.from('notifications').update({ read: true }).eq('id', id);
		notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
	}

	async function markAllAsRead() {
		const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
		if (unreadIds.length === 0) return;

		await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
		notifications = notifications.map((n) => ({ ...n, read: true }));
	}

	async function dismissNotification(id: string) {
		await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
		notifications = notifications.filter((n) => n.id !== id);
	}

	function getNotificationIcon(type: string) {
		switch (type) {
			case 'service_status':
				return CheckCheck;
			case 'new_request':
				return Package;
			case 'schedule_change':
				return CalendarClock;
			case 'past_due':
				return AlertTriangle;
			case 'daily_summary':
				return BarChart3;
			default:
				return Clock;
		}
	}

	function getNotificationColor(type: string, unread: boolean): string {
		if (!unread) return 'bg-muted text-muted-foreground';
		switch (type) {
			case 'new_request':
				return 'bg-blue-500/10 text-blue-600';
			case 'schedule_change':
				return 'bg-amber-500/10 text-amber-600';
			case 'service_status':
				return 'bg-green-500/10 text-green-600';
			case 'past_due':
				return 'bg-red-500/10 text-red-600';
			case 'daily_summary':
				return 'bg-purple-500/10 text-purple-600';
			default:
				return 'bg-primary/10 text-primary';
		}
	}

	function handleNotificationClick(notification: Notification) {
		open = false;
		markAsRead(notification.id);

		if (notification.service_id) {
			const basePath = userRole === 'courier' ? '/courier/services' : '/client/services';
			goto(localizeHref(`${basePath}/${notification.service_id}`));
		}
	}

	// Load notifications + real-time subscription
	onMount(() => {
		let canceled = false;

		(async () => {
			loading = true;
			const { data } = await supabase
				.from('notifications')
				.select('*')
				.eq('user_id', userId)
				.is('dismissed_at', null)
				.order('created_at', { ascending: false })
				.limit(20);

			if (canceled) return;
			notifications = (data || []) as Notification[];
			loading = false;
		})();

		const channel = supabase
			.channel('notifications')
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'notifications',
					filter: `user_id=eq.${userId}`
				},
				(payload) => {
					const newNotif = payload.new as Notification;
					if (!notifications.some((n) => n.id === newNotif.id)) {
						notifications = [newNotif, ...notifications].slice(0, 20);
					}
				}
			)
			.subscribe();

		return () => {
			canceled = true;
			supabase.removeChannel(channel);
		};
	});
</script>

{#snippet notificationItem(notification: Notification)}
	{@const Icon = getNotificationIcon(notification.type)}
	<div class="group relative" transition:fly={{ y: -10, duration: 200 }}>
		<button
			class="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted {!notification.read
				? 'bg-muted/50'
				: ''}"
			onclick={() => handleNotificationClick(notification)}
		>
			<div
				class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full {getNotificationColor(notification.type, !notification.read)}"
			>
				<Icon class="size-4" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium {!notification.read ? '' : 'text-muted-foreground'}">
					{notification.title}
				</p>
				<p class="text-xs text-muted-foreground line-clamp-2">
					{notification.message}
				</p>
				<p class="mt-1 text-xs text-muted-foreground">
					{formatRelativeTime(notification.created_at || '')}
				</p>
			</div>
			{#if !notification.read}
				<span
					role="button"
					tabindex="0"
					class="mt-2 size-3 shrink-0 rounded-full bg-primary hover:ring-2 hover:ring-primary/30 transition-shadow cursor-pointer"
					aria-label={m.notification_mark_read()}
					onclick={(e) => {
						e.stopPropagation();
						markAsRead(notification.id);
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.stopPropagation();
							e.preventDefault();
							markAsRead(notification.id);
						}
					}}
				></span>
			{/if}
		</button>
		<!-- Dismiss button on hover -->
		<button
			class="absolute right-7 top-2 rounded-md p-1 text-muted-foreground opacity-100 md:opacity-0 transition-opacity hover:bg-muted hover:text-foreground md:group-hover:opacity-100 focus:opacity-100"
			aria-label={m.notification_dismiss()}
			onclick={(e) => {
				e.stopPropagation();
				dismissNotification(notification.id);
			}}
		>
			<X class="size-3.5" />
		</button>
	</div>
{/snippet}

{#snippet notificationContent()}
	<!-- Header with settings link -->
	<div class="flex items-center justify-between px-3 py-2">
		<span class="font-semibold">{m.notifications()}</span>
		<Button
			variant="ghost"
			size="icon"
			class="size-6"
			onclick={() => {
				open = false;
				goto(localizeHref(userRole === 'courier' ? '/courier/settings?tab=notifications' : '/client/settings'));
			}}
		>
			<Settings class="size-4" />
		</Button>
	</div>
	<Separator />

	<!-- Tabs and unread filter -->
	<div class="flex items-center justify-between px-3 py-2 border-b">
		<div class="flex gap-1">
			<Button
				variant={activeTab === 'all' ? 'secondary' : 'ghost'}
				size="sm"
				class="h-7 text-xs"
				onclick={() => activeTab = 'all'}
			>
				{m.notification_tab_all()}
			</Button>
			<Button
				variant={activeTab === 'requests' ? 'secondary' : 'ghost'}
				size="sm"
				class="h-7 text-xs"
				onclick={() => activeTab = 'requests'}
			>
				{m.notification_tab_requests()}
			</Button>
			<Button
				variant={activeTab === 'alerts' ? 'secondary' : 'ghost'}
				size="sm"
				class="h-7 text-xs"
				onclick={() => activeTab = 'alerts'}
			>
				{m.notification_tab_alerts()}
			</Button>
		</div>
		<Button
			variant={showUnreadOnly ? 'secondary' : 'ghost'}
			size="sm"
			class="h-7 text-xs"
			onclick={() => showUnreadOnly = !showUnreadOnly}
		>
			{m.notification_filter_unread()}
		</Button>
	</div>

	<!-- Notification list with time grouping -->
	<div class="max-h-80 overflow-y-auto">
		{#if loading}
			<div class="px-3 py-4 text-center text-sm text-muted-foreground">
				{m.loading()}
			</div>
		{:else if groupedNotifications.today.length === 0 && groupedNotifications.earlier.length === 0}
			<div class="flex flex-col items-center justify-center px-3 py-8 text-center">
				<Bell class="size-10 text-muted-foreground/40 mb-3" />
				<p class="text-sm font-medium text-muted-foreground">{m.notification_empty_title()}</p>
				<p class="text-xs text-muted-foreground/70 mt-1">{m.notification_empty_subtitle()}</p>
			</div>
		{:else}
			{#if groupedNotifications.today.length > 0}
				<div class="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
					{m.notification_time_today()}
				</div>
				{#each groupedNotifications.today as notification (notification.id)}
					{@render notificationItem(notification)}
				{/each}
			{/if}

			{#if groupedNotifications.earlier.length > 0}
				<div class="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
					{m.notification_time_earlier()}
				</div>
				{#each groupedNotifications.earlier as notification (notification.id)}
					{@render notificationItem(notification)}
				{/each}
			{/if}
		{/if}
	</div>

	<!-- Footer: mark all read -->
	{#if unreadCount > 0}
		<Separator />
		<div class="px-3 py-2">
			<Button variant="outline" size="sm" class="w-full h-8 text-xs" onclick={markAllAsRead}>
				<CheckCheck class="size-3.5 mr-1.5" />
				{m.mark_all_read()}
			</Button>
		</div>
	{/if}
{/snippet}

<!-- Accessibility: sr-only live region for unread count -->
<div class="sr-only" aria-live="polite">
	{#if unreadCount > 0}
		{m.notification_unread_count({ count: unreadCount })}
	{/if}
</div>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				variant="ghost"
				size="sm"
				class="relative"
				aria-label="{m.notifications()}{unreadCount > 0 ? ` (${unreadCount})` : ''}"
				{...props}
			>
				<Bell class="size-5" />
				{#if unreadCount > 0}
					<span
						class="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
					>
						{formatBadge(unreadCount, 9)}
					</span>
				{/if}
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" collisionPadding={8} class="w-80 max-w-[calc(100vw-1rem)] shadow-xl">
		{@render notificationContent()}
	</DropdownMenu.Content>
</DropdownMenu.Root>
