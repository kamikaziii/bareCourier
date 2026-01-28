/**
 * Offline Store Service
 *
 * Uses IndexedDB via idb-keyval for offline data caching and pending mutations.
 * This service manages:
 * - Services cache for offline viewing
 * - Pending mutations queue for sync when back online
 * - Conflict detection and resolution for offline sync
 */

import {
	createStore,
	get,
	set,
	del,
	keys,
	clear,
	setMany,
	entries,
	type UseStore
} from 'idb-keyval';
import type { Service } from '$lib/database.types';

// Create separate stores for different data types
const servicesStore: UseStore = createStore('barecourier-services', 'services-cache');
const pendingStore: UseStore = createStore('barecourier-pending', 'pending-mutations');
const conflictsStore: UseStore = createStore('barecourier-conflicts', 'sync-conflicts');

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

// Types for sync conflicts
export interface SyncConflict {
	id: string;
	mutationId: string;
	serviceId: string;
	localChanges: Partial<Service>;
	serverData: Service;
	localUpdatedAt: string;
	serverUpdatedAt: string;
	conflictType: 'server_newer' | 'concurrent_edit';
	detectedAt: string;
	resolved: boolean;
	resolution?: 'keep_local' | 'keep_server' | 'merged';
}

// Conflict resolution strategy type
export type ConflictResolutionStrategy = 'keep_local' | 'keep_server' | 'prompt_user';

// ============ Services Cache ============

/**
 * Cache a single service
 */
export async function cacheService(service: Service): Promise<void> {
	await set(service.id, service, servicesStore);
}

/**
 * Cache multiple services using batch write
 * Uses setMany for O(1) transaction instead of N separate transactions
 */
export async function cacheServices(services: Service[]): Promise<void> {
	if (services.length === 0) return;
	const entries: [IDBValidKey, Service][] = services.map((s) => [s.id, s]);
	await setMany(entries, servicesStore);
}

/**
 * Get a cached service by ID
 */
export async function getCachedService(id: string): Promise<Service | undefined> {
	return get(id, servicesStore);
}

/**
 * Get all cached services using single-pass read
 * Uses entries for O(1) transaction instead of N separate get() calls
 */
export async function getAllCachedServices(): Promise<Service[]> {
	const allEntries = await entries<IDBValidKey, Service>(servicesStore);
	return allEntries.map(([, value]) => value).filter((s): s is Service => s !== undefined);
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
 * Get all pending mutations using single-pass read
 * Uses entries for O(1) transaction instead of N separate get() calls
 */
export async function getAllPendingMutations(): Promise<PendingMutation[]> {
	const allEntries = await entries<IDBValidKey, PendingMutation>(pendingStore);
	return allEntries
		.map(([, value]) => value)
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
		originalUpdatedAt: cachedService?.updated_at ?? undefined
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

// ============ Conflict Detection and Resolution ============

/**
 * Detect if there's a conflict between local mutation and server state.
 * Returns a SyncConflict if conflict is detected, undefined otherwise.
 */
export async function detectConflict(
	mutation: PendingMutation,
	serverData: Service
): Promise<SyncConflict | undefined> {
	// Only check updates - creates and deletes don't have version conflicts
	if (mutation.type !== 'update') {
		return undefined;
	}

	const serviceId = mutation.data.id as string;
	if (!serviceId) {
		return undefined;
	}

	// If we have no original timestamp, we can't detect conflicts
	if (!mutation.originalUpdatedAt) {
		return undefined;
	}

	const localUpdatedAt = new Date(mutation.originalUpdatedAt || '').getTime();
	const serverUpdatedAt = new Date(serverData.updated_at || '').getTime();

	// Server has been modified since we cached the data
	if (serverUpdatedAt > localUpdatedAt) {
		const conflict: SyncConflict = {
			id: crypto.randomUUID(),
			mutationId: mutation.id,
			serviceId,
			localChanges: mutation.data as Partial<Service>,
			serverData,
			localUpdatedAt: mutation.originalUpdatedAt || '',
			serverUpdatedAt: serverData.updated_at || '',
			conflictType: 'server_newer',
			detectedAt: new Date().toISOString(),
			resolved: false
		};

		// Store the conflict
		await set(conflict.id, conflict, conflictsStore);

		// Dispatch conflict event to notify UI
		dispatchConflictEvent(conflict);

		return conflict;
	}

	return undefined;
}

/**
 * Get all unresolved conflicts
 */
export async function getUnresolvedConflicts(): Promise<SyncConflict[]> {
	const allEntries = await entries<IDBValidKey, SyncConflict>(conflictsStore);
	return allEntries
		.map(([, value]) => value)
		.filter((c): c is SyncConflict => c !== undefined && !c.resolved)
		.sort((a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime());
}

/**
 * Get count of unresolved conflicts
 */
export async function getConflictCount(): Promise<number> {
	const conflicts = await getUnresolvedConflicts();
	return conflicts.length;
}

/**
 * Check if there are any unresolved conflicts
 */
export async function hasConflicts(): Promise<boolean> {
	const count = await getConflictCount();
	return count > 0;
}

/**
 * Get a specific conflict by ID
 */
export async function getConflict(id: string): Promise<SyncConflict | undefined> {
	return get(id, conflictsStore);
}

/**
 * Resolve a conflict with the specified strategy.
 * - 'keep_local': Apply local changes, overwriting server data
 * - 'keep_server': Discard local changes, keep server data
 * - 'merged': Apply a merged version (provided as mergedData)
 */
export async function resolveConflict(
	conflictId: string,
	resolution: 'keep_local' | 'keep_server' | 'merged',
	mergedData?: Partial<Service>
): Promise<{ success: boolean; error?: string }> {
	const conflict = await getConflict(conflictId);
	if (!conflict) {
		return { success: false, error: 'Conflict not found' };
	}

	try {
		if (resolution === 'keep_server') {
			// Update local cache with server data
			await cacheService(conflict.serverData);

			// Remove the pending mutation since we're discarding local changes
			await removePendingMutation(conflict.mutationId);
		} else if (resolution === 'keep_local') {
			// Keep the pending mutation - it will be retried
			// Update the originalUpdatedAt to server's current value to avoid re-detecting
			const mutation = await getPendingMutation(conflict.mutationId);
			if (mutation) {
				await updatePendingMutation(conflict.mutationId, {
					originalUpdatedAt: conflict.serverUpdatedAt
				});
			}
		} else if (resolution === 'merged' && mergedData) {
			// Update local cache with merged data
			const mergedService: Service = {
				...conflict.serverData,
				...mergedData,
				updated_at: new Date().toISOString()
			};
			await cacheService(mergedService);

			// Update the pending mutation with merged data
			await updatePendingMutation(conflict.mutationId, {
				data: { id: conflict.serviceId, ...mergedData },
				originalUpdatedAt: conflict.serverUpdatedAt
			});
		}

		// Mark conflict as resolved
		await set(
			conflictId,
			{
				...conflict,
				resolved: true,
				resolution
			},
			conflictsStore
		);

		// Dispatch event to update UI
		dispatchConflictResolvedEvent(conflict, resolution);

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error resolving conflict'
		};
	}
}

/**
 * Clear all resolved conflicts (cleanup)
 */
export async function clearResolvedConflicts(): Promise<void> {
	const allEntries = await entries<IDBValidKey, SyncConflict>(conflictsStore);
	const resolvedIds = allEntries
		.filter(([, value]) => value?.resolved)
		.map(([key]) => key as string);

	await Promise.all(resolvedIds.map((id) => del(id, conflictsStore)));
}

/**
 * Clear all conflicts
 */
export async function clearAllConflicts(): Promise<void> {
	await clear(conflictsStore);
}

/**
 * Dispatch a custom event when a conflict is detected
 */
function dispatchConflictEvent(conflict: SyncConflict): void {
	if (typeof window !== 'undefined') {
		window.dispatchEvent(
			new CustomEvent('sync-conflict', {
				detail: { conflict }
			})
		);
	}
}

/**
 * Dispatch a custom event when a conflict is resolved
 */
function dispatchConflictResolvedEvent(
	conflict: SyncConflict,
	resolution: 'keep_local' | 'keep_server' | 'merged'
): void {
	if (typeof window !== 'undefined') {
		window.dispatchEvent(
			new CustomEvent('sync-conflict-resolved', {
				detail: { conflict, resolution }
			})
		);
	}
}

/**
 * Sync a single pending mutation with conflict detection.
 * This should be called when attempting to sync with the server.
 *
 * @param mutation - The pending mutation to sync
 * @param fetchServerData - Function to fetch current server state for the record
 * @param applyMutation - Function to apply the mutation to the server
 * @returns Result indicating success, conflict, or error
 */
export async function syncMutationWithConflictCheck(
	mutation: PendingMutation,
	fetchServerData: (id: string) => Promise<Service | null>,
	applyMutation: (mutation: PendingMutation) => Promise<{ error?: { message: string } }>
): Promise<
	| { status: 'success' }
	| { status: 'conflict'; conflict: SyncConflict }
	| { status: 'error'; error: string }
> {
	try {
		// For updates, check for conflicts first
		if (mutation.type === 'update' && mutation.originalUpdatedAt) {
			const serviceId = mutation.data.id as string;
			if (serviceId) {
				// Fetch current server state
				const serverData = await fetchServerData(serviceId);

				if (serverData) {
					// Check for conflict
					const conflict = await detectConflict(mutation, serverData);
					if (conflict) {
						return { status: 'conflict', conflict };
					}
				}
			}
		}

		// No conflict detected, proceed with mutation
		const result = await applyMutation(mutation);

		if (result.error) {
			// Increment attempts
			await updatePendingMutation(mutation.id, {
				attempts: mutation.attempts + 1
			});
			return { status: 'error', error: result.error.message };
		}

		// Success - remove the pending mutation
		await removePendingMutation(mutation.id);
		return { status: 'success' };
	} catch (error) {
		return {
			status: 'error',
			error: error instanceof Error ? error.message : 'Unknown sync error'
		};
	}
}

/**
 * Process all pending mutations with conflict detection.
 * Stops on first conflict and returns it for user resolution.
 *
 * @param fetchServerData - Function to fetch current server state
 * @param applyMutation - Function to apply mutations to the server
 * @returns Summary of sync results
 */
export async function syncAllPendingMutations(
	fetchServerData: (id: string) => Promise<Service | null>,
	applyMutation: (mutation: PendingMutation) => Promise<{ error?: { message: string } }>
): Promise<{
	synced: number;
	conflicts: SyncConflict[];
	errors: Array<{ mutationId: string; error: string }>;
}> {
	const mutations = await getAllPendingMutations();
	const result = {
		synced: 0,
		conflicts: [] as SyncConflict[],
		errors: [] as Array<{ mutationId: string; error: string }>
	};

	for (const mutation of mutations) {
		const syncResult = await syncMutationWithConflictCheck(
			mutation,
			fetchServerData,
			applyMutation
		);

		if (syncResult.status === 'success') {
			result.synced++;
		} else if (syncResult.status === 'conflict') {
			result.conflicts.push(syncResult.conflict);
			// Continue processing other mutations - conflicts are stored and can be resolved later
		} else if (syncResult.status === 'error') {
			result.errors.push({ mutationId: mutation.id, error: syncResult.error });
		}
	}

	// Dispatch summary event
	if (typeof window !== 'undefined') {
		window.dispatchEvent(
			new CustomEvent('sync-complete', {
				detail: {
					synced: result.synced,
					conflictCount: result.conflicts.length,
					errorCount: result.errors.length
				}
			})
		);
	}

	return result;
}
