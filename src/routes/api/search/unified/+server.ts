import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { media } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import type { MediaRow } from '$lib/server/db';
import { mapRowsToSummaries } from '$lib/server/db/movie-select';
import { buildCacheKey, CACHE_TTL_SEARCH_SECONDS, withCache } from '$lib/server/cache';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { validateQueryParams, searchQuerySchema } from '$lib/server/validation';
import { personRepository } from '$lib/server/repositories/person.repository';
import { errorHandler } from '$lib/server';

const DEFAULT_LIMIT = 50;

const normalizeQuery = (value: string) => value.trim();

const searchQueryParamsSchema = z.object({
	q: searchQuerySchema,
	limit: z.coerce.number().int().positive().max(100).default(DEFAULT_LIMIT).optional(),
	types: z.string().optional()
});

export interface UnifiedSearchResult {
	media: any[];
	people: any[];
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const queryParams = validateQueryParams(searchQueryParamsSchema, url.searchParams);

		const query = normalizeQuery(queryParams.q);
		const limit = queryParams.limit ?? DEFAULT_LIMIT;
		const types = queryParams.types?.split(',').map((t) => t.trim().toLowerCase()) || [
			'movies',
			'media',
			'people'
		];

		const hash = createHash('sha1')
			.update(`${query.toLowerCase()}:${limit}:${types.join(',')}`)
			.digest('hex');
		const cacheKey = buildCacheKey('search', 'unified', hash);

		const results = await withCache<UnifiedSearchResult>(
			cacheKey,
			CACHE_TTL_SEARCH_SECONDS,
			async () => {
				const [mediaItems, people] = await Promise.all([
					(types.includes('movies') || types.includes('media')) ? searchMediaByQuery(query, limit) : Promise.resolve([]),
					types.includes('people')
						? personRepository.searchPeople({
								query,
								limit: Math.min(limit, 20)
							})
						: Promise.resolve([])
				]);

				return {
					media: mediaItems,
					people
				};
			}
		);

		return json(results);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

async function searchMediaByQuery(query: string, limit: number) {
	const ftsQuery = sanitizeForFts(query);

	if (!ftsQuery) {
		return [];
	}

	try {
		const searchSql = sql`
			SELECT m.*
			FROM movie_fts mf
			JOIN media m ON m.numericId = mf.rowid
			WHERE mf MATCH ${ftsQuery}
			ORDER BY bm25(mf) ASC,
				(m.rating IS NULL) ASC,
				m.rating DESC,
				(m.releaseDate IS NULL) ASC,
				m.releaseDate DESC,
				m.title COLLATE NOCASE ASC
			LIMIT ${limit}
		`;
		const rows = await db.all(searchSql);
		return await mapRowsToSummaries(rows as MediaRow[]);
	} catch (err) {
		console.error('[search] FTS query failed:', err);
		return [];
	}
}

function sanitizeForFts(term: string): string {
	return term
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.trim();
}