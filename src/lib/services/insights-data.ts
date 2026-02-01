import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Service } from '$lib/database.types';
import type { ChartData } from 'chart.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import * as m from '$lib/paraglide/messages.js';
import { formatDate as formatDateUtil, formatCurrency } from '$lib/utils.js';
import { getStatusLabel } from '$lib/utils/status.js';

// Constants
const PAGE_SIZE = 500;
const MAX_RECORDS = 10000;

// Types for insights data
export type ServiceWithProfile = Service & {
	profiles: Pick<Profile, 'id' | 'name'> | null;
};

export type MonthlyData = {
	month: string;
	services: number;
	km: number;
	revenue: number;
};

export type ClientData = {
	name: string;
	services: number;
	revenue: number;
};

export type StatusData = {
	pending: number;
	delivered: number;
};

export type Totals = {
	services: number;
	km: number;
	revenue: number;
	avgPerService: number;
};

export type FetchResult = {
	services: ServiceWithProfile[];
	hasMoreData: boolean;
	totalRecordsLoaded: number;
};

export type InsightsData = {
	services: ServiceWithProfile[];
	monthlyData: MonthlyData[];
	clientData: ClientData[];
	statusData: StatusData;
	totals: Totals;
	hasMoreData: boolean;
	totalRecordsLoaded: number;
};

/**
 * Fetch services within a date range with pagination
 */
export async function fetchServicesInRange(
	supabase: SupabaseClient,
	startDate: string,
	endDate: string
): Promise<FetchResult> {
	const endDatePlusOne = new Date(endDate);
	endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

	// Load services in paginated batches to avoid memory issues
	const allServices: ServiceWithProfile[] = [];
	let offset = 0;
	let hasMore = true;
	let hasMoreData = false;

	while (hasMore) {
		const { data: servicesData, error } = await supabase
			.from('services')
			.select('*, profiles!client_id(id, name)')
			.is('deleted_at', null)
			.gte('created_at', new Date(startDate).toISOString())
			.lt('created_at', endDatePlusOne.toISOString())
			.order('created_at', { ascending: false })
			.range(offset, offset + PAGE_SIZE - 1);

		// Handle query errors
		if (error) {
			console.error('Error fetching services batch:', error.message);
			break;
		}

		const batch = (servicesData as ServiceWithProfile[]) || [];

		// Use push for memory efficiency (avoids creating new arrays)
		allServices.push(...batch);

		// Check if there's more data to load
		if (batch.length < PAGE_SIZE) {
			hasMore = false;
		} else {
			offset += PAGE_SIZE;
		}

		// Safety limit: stop after MAX_RECORDS records to prevent browser issues
		if (allServices.length >= MAX_RECORDS) {
			hasMore = false;
			hasMoreData = true;
		}
	}

	return {
		services: allServices,
		hasMoreData,
		totalRecordsLoaded: allServices.length
	};
}

/**
 * Calculate totals from services
 */
export function calculateTotals(services: ServiceWithProfile[]): Totals {
	let totalKm = 0;
	let totalRevenue = 0;

	for (const s of services) {
		totalKm += s.distance_km || 0;
		totalRevenue += s.calculated_price || 0;
	}

	return {
		services: services.length,
		km: Math.round(totalKm * 10) / 10,
		revenue: Math.round(totalRevenue * 100) / 100,
		avgPerService: services.length > 0 ? Math.round((totalRevenue / services.length) * 100) / 100 : 0
	};
}

/**
 * Calculate status distribution
 */
export function calculateStatusData(services: ServiceWithProfile[]): StatusData {
	let pending = 0;
	let delivered = 0;

	for (const s of services) {
		if (s.status === 'pending') pending++;
		else delivered++;
	}

	return { pending, delivered };
}

/**
 * Group services by month
 */
export function calculateMonthlyData(services: ServiceWithProfile[]): MonthlyData[] {
	const monthMap = new Map<string, { services: number; km: number; revenue: number }>();

	for (const s of services) {
		const date = new Date(s.created_at || '');
		const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		const existing = monthMap.get(monthKey) || { services: 0, km: 0, revenue: 0 };
		existing.services++;
		existing.km += s.distance_km || 0;
		existing.revenue += s.calculated_price || 0;
		monthMap.set(monthKey, existing);
	}

	return Array.from(monthMap.entries())
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([month, d]) => ({
			month: formatMonthLabel(month),
			services: d.services,
			km: Math.round(d.km * 10) / 10,
			revenue: Math.round(d.revenue * 100) / 100
		}));
}

/**
 * Group services by client
 */
export function calculateClientData(
	services: ServiceWithProfile[],
	clients: Pick<Profile, 'id' | 'name'>[]
): ClientData[] {
	const clientMap = new Map<string, { services: number; revenue: number }>();

	for (const s of services) {
		const existing = clientMap.get(s.client_id) || { services: 0, revenue: 0 };
		existing.services++;
		existing.revenue += s.calculated_price || 0;
		clientMap.set(s.client_id, existing);
	}

	return Array.from(clientMap.entries())
		.map(([clientId, stats]) => {
			const client = clients.find((c) => c.id === clientId);
			return {
				name: client?.name || m.unknown_client(),
				services: stats.services,
				revenue: Math.round(stats.revenue * 100) / 100
			};
		})
		.sort((a, b) => b.revenue - a.revenue)
		.slice(0, 10);
}

/**
 * Format month key to localized label
 */
export function formatMonthLabel(monthKey: string): string {
	const [year, month] = monthKey.split('-');
	const date = new Date(parseInt(year), parseInt(month) - 1);
	return date.toLocaleDateString(getLocale(), { month: 'short', year: '2-digit' });
}

// Re-export formatCurrency from canonical source for backwards compatibility
export { formatCurrency };

/**
 * Format date string
 * Re-export from utils for backwards compatibility
 */
export const formatDate = formatDateUtil;

// Re-export from canonical source for backwards compatibility
export { getStatusLabel };


// Chart data builders

export function buildServicesChartData(monthlyData: MonthlyData[]): ChartData<'bar'> {
	return {
		labels: monthlyData.map((d) => d.month),
		datasets: [
			{
				label: m.analytics_services(),
				data: monthlyData.map((d) => d.services),
				backgroundColor: 'rgba(59, 130, 246, 0.8)',
				borderColor: 'rgb(59, 130, 246)',
				borderWidth: 1
			}
		]
	};
}

export function buildRevenueChartData(monthlyData: MonthlyData[]): ChartData<'line'> {
	return {
		labels: monthlyData.map((d) => d.month),
		datasets: [
			{
				label: m.analytics_revenue(),
				data: monthlyData.map((d) => d.revenue),
				borderColor: 'rgb(234, 179, 8)',
				backgroundColor: 'rgba(234, 179, 8, 0.1)',
				fill: true,
				tension: 0.3
			}
		]
	};
}

export function buildDistanceChartData(monthlyData: MonthlyData[]): ChartData<'line'> {
	return {
		labels: monthlyData.map((d) => d.month),
		datasets: [
			{
				label: m.analytics_distance(),
				data: monthlyData.map((d) => d.km),
				borderColor: 'rgb(34, 197, 94)',
				backgroundColor: 'rgba(34, 197, 94, 0.1)',
				fill: true,
				tension: 0.3
			}
		]
	};
}

export function buildClientChartData(clientData: ClientData[]): ChartData<'bar'> {
	return {
		labels: clientData.map((d) => d.name),
		datasets: [
			{
				label: m.analytics_revenue(),
				data: clientData.map((d) => d.revenue),
				backgroundColor: 'rgba(168, 85, 247, 0.8)',
				borderColor: 'rgb(168, 85, 247)',
				borderWidth: 1
			}
		]
	};
}

export function buildStatusChartData(statusData: StatusData): ChartData<'doughnut'> {
	return {
		labels: [m.status_pending(), m.status_delivered()],
		datasets: [
			{
				data: [statusData.pending, statusData.delivered],
				backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(34, 197, 94, 0.8)'],
				borderColor: ['rgb(59, 130, 246)', 'rgb(34, 197, 94)'],
				borderWidth: 1
			}
		]
	};
}

/**
 * Export services to CSV
 */
export function exportServicesToCSV(
	services: ServiceWithProfile[],
	startDate: string,
	endDate: string
): void {
	const locale = getLocale();
	const headers = [
		m.reports_table_date(),
		m.reports_table_client(),
		m.form_pickup_location(),
		m.form_delivery_location(),
		m.reports_status(),
		m.form_notes(),
		m.status_delivered()
	];

	const rows = services.map((s) => [
		new Date(s.created_at || '').toLocaleDateString(locale),
		s.profiles?.name || m.unknown_client(),
		s.pickup_location,
		s.delivery_location,
		getStatusLabel(s.status),
		s.notes || '',
		s.delivered_at ? new Date(s.delivered_at).toLocaleString(locale) : ''
	]);

	const csvContent = [
		headers.join(','),
		...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
	].join('\n');

	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `services_${startDate}_to_${endDate}.csv`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
