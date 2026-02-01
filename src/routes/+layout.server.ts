import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
	const { session, user } = await safeGetSession();

	// Filter session to only expose necessary fields - never expose tokens to client
	// Use `user` from getUser() (validated) instead of `session.user` (from cookies, unvalidated)
	const safeSession = session && user
		? {
				expires_at: session.expires_at,
				user: {
					id: user.id,
					email: user.email
				}
			}
		: null;

	return {
		session: safeSession,
		cookies: cookies.getAll()
	};
};
