import type { Component } from 'svelte';

export interface NavItem {
	href: string;
	label: string;
	icon: Component;
	badge?: number | PromiseLike<number>;
}

/**
 * Check if a navigation item is active based on the current pathname.
 * Matches exact paths and nested routes (e.g., /courier/services matches /courier/services/new)
 */
export function isItemActive(itemHref: string, pathname: string): boolean {
	// Dashboard (exact /courier or /client) should only match exactly
	if (itemHref === '/courier' || itemHref === '/client') {
		return pathname === itemHref;
	}
	if (pathname === itemHref) return true;
	// For nested routes, check if current path starts with item href
	if (itemHref !== '/' && pathname.startsWith(itemHref + '/')) return true;
	return false;
}
