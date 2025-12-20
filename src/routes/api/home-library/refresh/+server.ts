import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { libraryService } from '$lib/server';
import { errorHandler } from '$lib/server';

export const POST: RequestHandler = async () => {
	try {
		const data = await libraryService.fetchHomeLibrary({ forceRefresh: true });
		return json({ success: true, data });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
