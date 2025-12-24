import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { libraryRepository } from '$lib/server';
import { z } from 'zod';
import { validateQueryParams } from '$lib/server/validation';
import { errorHandler } from '$lib/server';

const topRatedQueryParamsSchema = z.object({
	limit: z.coerce.number().int().positive().max(100).default(20),
	offset: z.coerce.number().int().min(0).default(0)
});

export const GET: RequestHandler = async ({ url }) => {
	try {
		const queryParams = validateQueryParams(topRatedQueryParamsSchema, url.searchParams);
		const movies = await libraryRepository.findMoviesWithFilters(
			{},
			{ field: 'rating', order: 'desc' },
			{ page: Math.floor(queryParams.offset / queryParams.limit) + 1, pageSize: queryParams.limit }
		);

		return json({ movies: movies.items, total: movies.pagination.totalItems });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
