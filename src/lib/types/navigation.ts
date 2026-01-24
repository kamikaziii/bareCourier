import type { Component } from 'svelte';

export interface NavItem {
	href: string;
	label: string;
	icon: Component;
	badge?: number;
}

/**
 * Check if a navigation item is active based on the current pathname.
 * Matches exact paths and nested routes (e.g., /courier/services matches /courier/services/new)
 */
export function isItemActive(itemHref: string, pathname: string): boolean {
	if (pathname === itemHref) return true;
	// For nested routes, check if current path starts with item href
	// But don't match parent if we're on an exact child route
	if (itemHref !== '/' && pathname.startsWith(itemHref + '/')) return true;
	return false;
}
