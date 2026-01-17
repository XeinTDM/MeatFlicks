import type { LayoutServerLoad } from './$types';
import { getCsrfToken } from '$lib/server/csrf';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const csrfToken = getCsrfToken({ cookies });

	return {
		user: locals.user ?? null,
		csrfToken: csrfToken ?? undefined
	};
};
