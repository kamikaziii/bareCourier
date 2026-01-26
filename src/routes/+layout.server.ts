import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
	const { session } = await safeGetSession();

	// Filter session to only expose necessary fields - never expose tokens to client
	const safeSession = session
		? {
				expires_at: session.expires_at,
				user: {
					id: session.user.id,
					email: session.user.email
				}
			}
		: null;

	return {
		session: safeSession,
		cookies: cookies.getAll()
	};
};
