import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { libraryRepository } from '$lib/server';
import { z } from 'zod';
import { validateQueryParams } from '$lib/server/validation';
import { errorHandler } from '$lib/server';
import type { LibraryMedia } from '$lib/types/library';

const recentlyAddedQueryParamsSchema = z.object({
	limit: z.coerce.number().int().positive().max(100).default(50),
	offset: z.coerce.number().int().min(0).default(0)
});

export const GET: RequestHandler = async ({ url }) => {
	try {
		const queryParams = validateQueryParams(recentlyAddedQueryParamsSchema, url.searchParams);
		const media = await libraryRepository.findMoviesWithFilters(
			{},
			{ field: 'releaseDate', order: 'desc' },
			{ page: Math.floor(queryParams.offset / queryParams.limit) + 1, pageSize: queryParams.limit }
		);

		const mediaWithPaths = media.items.map(
			(item): LibraryMedia => ({
				...item,
				canonicalPath: (() => {
					const type = item.mediaType || 'movie';
					const prefix = type === 'tv' ? '/tv/' : '/movie/';
					return item.tmdbId ? `${prefix}${item.tmdbId}` : `${prefix}${item.id}`;
				})(),
				releaseDate: item.releaseDate ?? null,
				durationMinutes: item.durationMinutes ?? null,
				genres: item.genres ?? []
			})
		);

		return json({ media: mediaWithPaths, total: media.pagination.totalItems });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
