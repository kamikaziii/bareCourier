import type { RequestHandler } from './$types';

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
		.single();

	if (profile?.role !== 'courier') {
		return new Response('Forbidden', { status: 403 });
	}

	const startDate = url.searchParams.get('start');
	const endDate = url.searchParams.get('end');
	const clientId = url.searchParams.get('client_id');

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

	const { data: services, error } = await query;

	if (error) {
		return new Response(error.message, { status: 500 });
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

	const filename = `report-${startDate || 'all'}-${endDate || 'all'}.csv`;

	return new Response(csvContent, {
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
