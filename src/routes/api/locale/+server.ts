import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { locale } = await request.json();

	if (!['pt-PT', 'en'].includes(locale)) {
		return json({ error: 'Invalid locale' }, { status: 400 });
	}

	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { error } = await locals.supabase.from('profiles').update({ locale }).eq('id', user.id);

	if (error) {
		return json({ error: error.message }, { status: 500 });
	}

	return json({ success: true });
};
