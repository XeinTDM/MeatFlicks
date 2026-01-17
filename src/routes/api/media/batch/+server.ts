import { json, type RequestHandler } from '@sveltejs/kit';
import { libraryRepository } from '$lib/server/repositories/library.repository';
import { z } from 'zod';
import { validateQueryParams } from '$lib/server/validation';
import { errorHandler } from '$lib/server';

const batchQueryParamsSchema = z.object({
	ids: z.string().transform((val) => val.split(',').filter(Boolean)).default([] as any)
});

export const GET: RequestHandler = async ({ url }) => {
	try {
		const { ids } = validateQueryParams(batchQueryParamsSchema, url.searchParams);
		
		if (!ids || ids.length === 0) {
			return json({ media: [] });
		}

		const mediaItems = await libraryRepository.findMoviesByIds(ids as string[]);
		return json({ media: mediaItems });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};