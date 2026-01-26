import type { RequestHandler } from './$types';
import type { Service } from '$lib/database.types';

type ServiceWithProfile = Service & { profiles: { name: string } | null };

/**
 * Sanitizes a string for safe use in Content-Disposition filename.
 * Removes newlines, carriage returns, quotes, semicolons, and non-alphanumeric chars (except hyphens).
 */
function sanitizeFilenameComponent(str: string): string {
	return str.replace(/[^a-zA-Z0-9-]/g, '');
}

/**
 * Validates that a date string matches ISO 8601 format (YYYY-MM-DD)
 * and represents a valid calendar date.
 */
function isValidDateFormat(dateStr: string): boolean {
	// Check format: YYYY-MM-DD
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateRegex.test(dateStr)) {
		return false;
	}

	// Validate it's a real date (e.g., not 2024-02-30)
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) {
		return false;
	}

	// Ensure the parsed date matches the input (catches invalid dates like Feb 30)
	const [year, month, day] = dateStr.split('-').map(Number);
	return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		return new Response('Unauthorized', { status: 401 });
	}

	// Verify courier role
	const { data: profile } = await supabase
		.from('profiles')
		.select('role')
		.eq('id', user.id)
		.single() as { data: { role: string } | null };

	if (profile?.role !== 'courier') {
		return new Response('Forbidden', { status: 403 });
	}

	const startDate = url.searchParams.get('start');
	const endDate = url.searchParams.get('end');
	const clientId = url.searchParams.get('client_id');

	// Validate date format (YYYY-MM-DD) if dates are provided
	if (startDate && !isValidDateFormat(startDate)) {
		return new Response('Invalid start date format. Use YYYY-MM-DD', { status: 400 });
	}
	if (endDate && !isValidDateFormat(endDate)) {
		return new Response('Invalid end date format. Use YYYY-MM-DD', { status: 400 });
	}

	// Validate UUID format if clientId is provided
	if (clientId) {
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!uuidRegex.test(clientId)) {
			return new Response('Invalid client_id format', { status: 400 });
		}
	}

	// Build query
	let query = supabase
		.from('services')
		.select('*, profiles!client_id(name)')
		.is('deleted_at', null)
		.order('created_at', { ascending: false });

	if (startDate) {
		query = query.gte('created_at', startDate);
	}
	if (endDate) {
		query = query.lt('created_at', endDate);
	}
	if (clientId) {
		query = query.eq('client_id', clientId);
	}

	const { data: services, error } = await query as { data: ServiceWithProfile[] | null; error: { message: string } | null };

	if (error) {
		console.error('CSV export failed:', error.message);
		return new Response('Failed to generate report', { status: 500 });
	}

	// Generate CSV
	const headers = ['ID', 'Client', 'Pickup', 'Delivery', 'Status', 'Created', 'Price'];
	const rows =
		services?.map((s) => [
			s.id,
			(s.profiles as { name: string } | null)?.name || '',
			s.pickup_location,
			s.delivery_location,
			s.status,
			s.created_at,
			s.calculated_price || ''
		]) || [];

	const csvContent = [
		headers.join(','),
		...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
	].join('\n');

	// Sanitize date values for safe use in filename (defense in depth)
	const safeStart = startDate ? sanitizeFilenameComponent(startDate) : 'all';
	const safeEnd = endDate ? sanitizeFilenameComponent(endDate) : 'all';
	const filename = `report-${safeStart}-${safeEnd}.csv`;

	return new Response(csvContent, {
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
