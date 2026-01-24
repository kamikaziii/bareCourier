/**
 * Offline Store Service
 *
 * Uses IndexedDB via idb-keyval for offline data caching and pending mutations.
 * This service manages:
 * - Services cache for offline viewing
 * - Pending mutations queue for sync when back online
 */

import { createStore, get, set, del, keys, clear, type UseStore } from 'idb-keyval';
import type { Service } from '$lib/database.types';

// Create separate stores for different data types
const servicesStore: UseStore = createStore('barecourier-services', 'services-cache');
const pendingStore: UseStore = createStore('barecourier-pending', 'pending-mutations');

// Types for pending mutations
export interface PendingMutation {
	id: string;
	type: 'update' | 'create' | 'delete';
	table: string;
	data: Record<string, unknown>;
	originalUpdatedAt?: string;
	createdAt: string;
	attempts: number;
}

// ============ Services Cache ============

/**
 * Cache a single service
 */
export async function cacheService(service: Service): Promise<void> {
	await set(service.id, service, servicesStore);
}

/**
 * Cache multiple services
 */
export async function cacheServices(services: Service[]): Promise<void> {
	await Promise.all(services.map((s) => set(s.id, s, servicesStore)));
}

/**
 * Get a cached service by ID
 */
export async function getCachedService(id: string): Promise<Service | undefined> {
	return get(id, servicesStore);
}

/**
 * Get all cached services
 */
export async function getAllCachedServices(): Promise<Service[]> {
	const allKeys = await keys(servicesStore);
	const services = await Promise.all(allKeys.map((key) => get(key, servicesStore)));
	return services.filter((s): s is Service => s !== undefined);
}

/**
 * Remove a service from cache
 */
export async function removeCachedService(id: string): Promise<void> {
	await del(id, servicesStore);
}

/**
 * Clear all cached services
 */
export async function clearServicesCache(): Promise<void> {
	await clear(servicesStore);
}

// ============ Pending Mutations ============

/**
 * Add a pending mutation to the queue
 */
export async function addPendingMutation(
	mutation: Omit<PendingMutation, 'id' | 'createdAt' | 'attempts'>
): Promise<string> {
	const id = crypto.randomUUID();
	const pendingMutation: PendingMutation = {
		...mutation,
		id,
		createdAt: new Date().toISOString(),
		attempts: 0
	};
	await set(id, pendingMutation, pendingStore);

	// Dispatch event to update UI
	dispatchSyncEvent();

	return id;
}

/**
 * Get all pending mutations
 */
export async function getAllPendingMutations(): Promise<PendingMutation[]> {
	const allKeys = await keys(pendingStore);
	const mutations = await Promise.all(allKeys.map((key) => get(key, pendingStore)));
	return mutations
		.filter((m): m is PendingMutation => m !== undefined)
		.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Get count of pending mutations
 */
export async function getPendingCount(): Promise<number> {
	const allKeys = await keys(pendingStore);
	return allKeys.length;
}

/**
 * Get a specific pending mutation
 */
export async function getPendingMutation(id: string): Promise<PendingMutation | undefined> {
	return get(id, pendingStore);
}

/**
 * Update a pending mutation (e.g., increment attempts)
 */
export async function updatePendingMutation(
	id: string,
	updates: Partial<PendingMutation>
): Promise<void> {
	const mutation = await get(id, pendingStore);
	if (mutation) {
		await set(id, { ...mutation, ...updates }, pendingStore);
	}
}

/**
 * Remove a pending mutation (after successful sync)
 */
export async function removePendingMutation(id: string): Promise<void> {
	await del(id, pendingStore);

	// Dispatch event to update UI
	dispatchSyncEvent();
}

/**
 * Clear all pending mutations
 */
export async function clearPendingMutations(): Promise<void> {
	await clear(pendingStore);

	// Dispatch event to update UI
	dispatchSyncEvent();
}

// ============ Sync Helpers ============

/**
 * Dispatch a custom event to update the OfflineIndicator
 */
async function dispatchSyncEvent(): Promise<void> {
	if (typeof window !== 'undefined') {
		const pending = await getPendingCount();
		window.dispatchEvent(
			new CustomEvent('sync-update', {
				detail: { pending }
			})
		);
	}
}

/**
 * Check if there are any pending mutations
 */
export async function hasPendingMutations(): Promise<boolean> {
	const count = await getPendingCount();
	return count > 0;
}

/**
 * Apply optimistic update to cache and queue for sync
 * Returns the mutation ID for potential rollback
 */
export async function applyOptimisticUpdate(
	serviceId: string,
	updates: Partial<Service>
): Promise<string> {
	// Get the current cached service
	const cachedService = await getCachedService(serviceId);

	if (cachedService) {
		// Update the cache optimistically
		const updatedService = {
			...cachedService,
			...updates,
			updated_at: new Date().toISOString()
		};
		await cacheService(updatedService);
	}

	// Queue the mutation for sync
	const mutationId = await addPendingMutation({
		type: 'update',
		table: 'services',
		data: {
			id: serviceId,
			...updates
		},
		originalUpdatedAt: cachedService?.updated_at
	});

	return mutationId;
}

/**
 * Rollback an optimistic update
 */
export async function rollbackOptimisticUpdate(
	serviceId: string,
	mutationId: string,
	originalData: Partial<Service>
): Promise<void> {
	// Restore the original data in cache
	const cachedService = await getCachedService(serviceId);
	if (cachedService) {
		await cacheService({
			...cachedService,
			...originalData
		});
	}

	// Remove the pending mutation
	await removePendingMutation(mutationId);
}
