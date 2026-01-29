/**
 * Workload Status Styling Utilities
 * Shared styles and icon mappings for workload status display.
 */

import { CheckCircle, Clock, AlertTriangle } from '@lucide/svelte';
import type { WorkloadEstimate } from './workload.js';

export type WorkloadStatus = WorkloadEstimate['status'];

export interface WorkloadStyleConfig {
	bg: string;
	text: string;
	icon: typeof CheckCircle | typeof Clock | typeof AlertTriangle;
}

export const WORKLOAD_STYLES: Record<WorkloadStatus, WorkloadStyleConfig> = {
	comfortable: {
		bg: 'bg-green-50 dark:bg-green-950/30',
		text: 'text-green-600',
		icon: CheckCircle
	},
	tight: {
		bg: 'bg-yellow-50 dark:bg-yellow-950/30',
		text: 'text-yellow-600',
		icon: Clock
	},
	overloaded: {
		bg: 'bg-red-50 dark:bg-red-950/30',
		text: 'text-red-600',
		icon: AlertTriangle
	}
} as const;

/**
 * Get the style configuration for a workload status.
 */
export function getWorkloadStyles(status: WorkloadStatus): WorkloadStyleConfig {
	return WORKLOAD_STYLES[status];
}
