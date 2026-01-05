import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { libraryRepository } from '$lib/server';
import { z } from 'zod';
import { validateQueryParams } from '$lib/server/validation';
import { errorHandler } from '$lib/server';
import type { LibraryMovie } from '$lib/types/library';

const topRatedQueryParamsSchema = z.object({
	limit: z.coerce.number().int().positive().max(100).default(50),
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

		const moviesWithPaths = movies.items.map(
			(movie): LibraryMovie => ({
				...movie,
				canonicalPath: (() => {
					const type = movie.mediaType || 'movie';
					const prefix = type === 'tv' ? '/tv/' : '/movie/';
					return movie.tmdbId ? `${prefix}${movie.tmdbId}` : `${prefix}${movie.id}`;
				})(),
				releaseDate: movie.releaseDate ?? null,
				durationMinutes: movie.durationMinutes ?? null,
				genres: movie.genres ?? []
			})
		);

		return json({ movies: moviesWithPaths, total: movies.pagination.totalItems });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
