import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { movies } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import type { MovieRow } from '$lib/server/db';
import { mapRowsToSummaries } from '$lib/server/db/movie-select';
import { buildCacheKey, CACHE_TTL_SHORT_SECONDS, withCache } from '$lib/server/cache';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { validateQueryParams, searchQuerySchema } from '$lib/server/validation';
import { personRepository } from '$lib/server/repositories/person.repository';

const DEFAULT_LIMIT = 50;

const normalizeQuery = (value: string) => value.trim();

const parseLimit = (value: string | null): number => {
	if (!value) {
		return DEFAULT_LIMIT;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_LIMIT;
	}

	return Math.min(parsed, DEFAULT_LIMIT);
};

const searchQueryParamsSchema = z.object({
	q: searchQuerySchema,
	limit: z.coerce.number().int().positive().max(100).default(DEFAULT_LIMIT).optional(),
	types: z.string().optional() // Comma-separated list of types to search (movies,people)
});

export interface UnifiedSearchResult {
	movies: any[];
	people: any[];
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Validate query parameters
		const queryParams = validateQueryParams(searchQueryParamsSchema, url.searchParams);

		const query = normalizeQuery(queryParams.q);
		const limit = queryParams.limit ?? DEFAULT_LIMIT;
		const types = queryParams.types?.split(',').map(t => t.trim().toLowerCase()) || ['movies', 'people'];

		const hash = createHash('sha1')
			.update(`${query.toLowerCase()}:${limit}:${types.join(',')}`)
			.digest('hex');
		const cacheKey = buildCacheKey('search', 'unified', hash);

		const results = await withCache<UnifiedSearchResult>(cacheKey, CACHE_TTL_SHORT_SECONDS, async () => {
			const [movies, people] = await Promise.all([
				types.includes('movies') ? searchMoviesByQuery(query, limit) : Promise.resolve([]),
				types.includes('people') ? personRepository.searchPeople({
					query,
					limit: Math.min(limit, 20) // Limit people results to reasonable number
				}) : Promise.resolve([])
			]);

			return {
				movies,
				people
			};
		});

		return json(results);
	} catch (error) {
		console.error('Error in unified search:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};

// Helper function to search movies (extracted from original search endpoint)
async function searchMoviesByQuery(query: string, limit: number) {
	const ftsQuery = sanitizeForFts(query);
	let rows: any[] = [];
	let ftsFailed = false;

	if (ftsQuery) {
		try {
			// Raw SQL via Drizzle for FTS5
			const searchSql = sql`
				SELECT m.*
				FROM movie_fts mf
				JOIN movies m ON m.numericId = mf.rowid
				WHERE mf MATCH ${ftsQuery}
				ORDER BY bm25(mf) ASC,
					(m.rating IS NULL) ASC,
					m.rating DESC,
					(m.releaseDate IS NULL) ASC,
					m.releaseDate DESC,
					m.title COLLATE NOCASE ASC
				LIMIT ${limit}
			`;
			rows = await db.all(searchSql);
		} catch (err) {
			console.warn('[search] FTS failed (table might be missing), falling back to LIKE:', err);
			ftsFailed = true;
		}
	}

	if (rows.length === 0 || ftsFailed) {
		const likeTerm = `%${query.replace(/%/g, '%%')}%`;
		const fallbackSql = sql`
			SELECT *
			FROM movies m
			WHERE m.title LIKE ${likeTerm} OR m.overview LIKE ${likeTerm}
			ORDER BY
				(m.rating IS NULL) ASC,
				m.rating DESC,
				(m.releaseDate IS NULL) ASC,
				m.releaseDate DESC,
				m.title COLLATE NOCASE ASC
			LIMIT ${limit}
		`;
		rows = await db.all(fallbackSql);
	}

	return await mapRowsToSummaries(rows as MovieRow[]);
}

function sanitizeForFts(term: string): string {
	const cleaned = term
		.toLowerCase()
		.replace(/[^a-z0-9\s]/gi, ' ')
		.split(/\s+/)
		.filter(Boolean);

	if (cleaned.length === 0) {
		return '';
	}

	return cleaned.map((token) => `${token}*`).join(' ');
}
