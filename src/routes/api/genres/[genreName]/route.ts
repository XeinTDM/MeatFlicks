import { json, type RequestHandler } from '@sveltejs/kit';
import { libraryRepository } from '$lib/server';
import { z } from 'zod';
import { validatePathParams, validateQueryParams } from '$lib/server/validation';
import { errorHandler } from '$lib/server';

const DEFAULT_LIMIT = 50;

const genrePathParamsSchema = z.object({
	genreName: z.string().min(1, 'Genre is required')
});

const genreQueryParamsSchema = z.object({
	limit: z.coerce.number().int().positive().max(100).default(DEFAULT_LIMIT).optional(),
	offset: z.coerce.number().int().min(0).default(0).optional()
});

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		// Validate path parameters
		const pathParams = validatePathParams(genrePathParamsSchema, params);

		// Validate query parameters
		const queryParams = validateQueryParams(genreQueryParamsSchema, url.searchParams);

		const movies = await libraryRepository.findGenreMovies(
			pathParams.genreName,
			queryParams.limit,
			queryParams.offset
		);

		if (movies.length === 0) {
			return json({ message: 'No movies found for genre: ' + pathParams.genreName }, { status: 404 });
		}

		return json(movies);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
