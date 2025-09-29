import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { libraryService } from '$lib/server';

export const POST: RequestHandler = async () => {
	try {
		const data = await libraryService.fetchHomeLibrary({ forceRefresh: true });
		return json({ success: true, data });
	} catch (error) {
		console.error('[api][home-library] failed to refresh home library', error);
		return json({ success: false, error: 'Failed to refresh home library.' }, { status: 500 });
	}
};
