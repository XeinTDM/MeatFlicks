import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { mapRowsToSummaries } from '$lib/server/db/movie-select';
import { withCache, buildCacheKey, CACHE_TTL_SEARCH_SECONDS } from '$lib/server/cache';
import { logger } from '$lib/server/logger';
import type { MovieSummary } from '$lib/server/db';

interface SearchOptions {
	query?: string;
	limit?: number;
	offset?: number;
	genres?: string[];
	minRating?: number;
	maxRating?: number;
	minYear?: number;
	maxYear?: number;
	sortBy?: 'relevance' | 'rating' | 'releaseDate' | 'title';
	sortOrder?: 'asc' | 'desc';
	includeAdult?: boolean;
}

interface SearchResult {
	results: MovieSummary[];
	total: number;
	genres: { id: number; name: string; count: number }[];
	years: { year: number; count: number }[];
	ratings: { rating: number; count: number }[];
	suggestions: string[];
}

interface AutocompleteResult {
	suggestions: string[];
	movies: MovieSummary[];
	people: Array<{ id: number; name: string; type: 'actor' | 'director' }>;
}

const DEFAULT_LIMIT = 20;
const AUTOCOMPLETE_LIMIT = 10;

function normalizeQuery(query: string): string {
	return query.trim().toLowerCase();
}

function createFuzzySearchQuery(term: string): string {
	return term
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.trim();
}

function createAutocompleteQuery(term: string): string {
	const cleaned = term.replace(/[^a-z0-9\s]/gi, ' ').trim();
	if (cleaned.length === 0) return '';
	return `${cleaned}* OR ${cleaned}*`;
}

async function getGenreFacets(
	genreIds: number[]
): Promise<{ id: number; name: string; count: number }[]> {
	if (genreIds.length === 0) return [];

	try {
		const results = await db.all(sql`
			SELECT g.id, g.name, COUNT(*) as count
			FROM genres g
			WHERE g.id IN (${genreIds.join(',')})
			GROUP BY g.id, g.name
			ORDER BY count DESC, g.name ASC
		`);

		return results.map((row: any) => ({
			id: row.id as number,
			name: row.name as string,
			count: row.count as number
		}));
	} catch (error) {
		logger.error({ error }, 'Failed to get genre facets');
		return [];
	}
}

async function getYearFacets(
	minYear?: number,
	maxYear?: number
): Promise<{ year: number; count: number }[]> {
	try {
		let yearFilter = sql`1 = 1`;
		if (minYear && maxYear) {
			yearFilter = sql`strftime('%Y', m.releaseDate) BETWEEN ${minYear} AND ${maxYear}`;
		} else if (minYear) {
			yearFilter = sql`strftime('%Y', m.releaseDate) >= ${minYear}`;
		} else if (maxYear) {
			yearFilter = sql`strftime('%Y', m.releaseDate) <= ${maxYear}`;
		}

		const results = await db.all(sql`
			SELECT strftime('%Y', m.releaseDate) as year, COUNT(*) as count
			FROM movies m
			WHERE m.releaseDate IS NOT NULL AND ${yearFilter}
			GROUP BY year
			ORDER BY year DESC
			LIMIT 20
		`);

		return results
			.map((row: any) => ({
				year: parseInt(row.year as string),
				count: row.count as number
			}))
			.filter((item) => !isNaN(item.year));
	} catch (error) {
		logger.error({ error }, 'Failed to get year facets');
		return [];
	}
}

async function getRatingFacets(): Promise<{ rating: number; count: number }[]> {
	try {
		const results = await db.all(sql`
			SELECT
				CASE
					WHEN m.rating >= 8 THEN '8+'
					WHEN m.rating >= 7 THEN '7-8'
					WHEN m.rating >= 6 THEN '6-7'
					WHEN m.rating >= 5 THEN '5-6'
					ELSE 'Below 5'
				END as rating_range,
				COUNT(*) as count
			FROM movies m
			WHERE m.rating IS NOT NULL
			GROUP BY rating_range
			ORDER BY rating_range DESC
		`);

		return results.map((row: any) => {
			const range = row.rating_range as string;
			let rating: number;

			if (range === '8+') rating = 8;
			else if (range === '7-8') rating = 7.5;
			else if (range === '6-7') rating = 6.5;
			else if (range === '5-6') rating = 5.5;
			else rating = 4;

			return {
				rating,
				count: row.count as number
			};
		});
	} catch (error) {
		logger.error({ error }, 'Failed to get rating facets');
		return [];
	}
}

async function getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
	if (!query || query.length < 2) return [];

	try {
		const ftsQuery = createAutocompleteQuery(query);
		const results = await db.all(sql`
			SELECT DISTINCT m.title
			FROM movie_fts mf
			JOIN movies m ON m.numericId = mf.rowid
			WHERE mf MATCH ${ftsQuery}
			LIMIT ${limit}
		`);

		return results.map((row: any) => row.title as string).filter(Boolean);
	} catch (error) {
		logger.error({ error }, 'Failed to get search suggestions');
		return [];
	}
}

async function getAutocompletePeople(
	query: string,
	limit: number = 5
): Promise<AutocompleteResult['people']> {
	if (!query || query.length < 2) return [];

	try {
		const likeTerm = `%${query.replace(/%/g, '%%')}%`;
		const results = await db.all(sql`
			SELECT id, name, knownForDepartment
			FROM people
			WHERE name LIKE ${likeTerm}
			LIMIT ${limit}
		`);

		return results.map((row: any) => ({
			id: row.id as number,
			name: row.name as string,
			type: row.knownForDepartment?.toLowerCase().includes('act') ? 'actor' : 'director'
		}));
	} catch (error) {
		logger.error({ error }, 'Failed to get autocomplete people');
		return [];
	}
}

export async function enhancedSearch(options: SearchOptions): Promise<SearchResult> {
	const {
		query = '',
		limit = DEFAULT_LIMIT,
		offset = 0,
		genres = [],
		minRating,
		maxRating,
		minYear,
		maxYear,
		sortBy = 'relevance',
		sortOrder = 'desc',
		includeAdult = false
	} = options;

	const normalizedQuery = normalizeQuery(query);
	const cacheKey = buildCacheKey(
		'enhanced-search',
		normalizedQuery,
		limit,
		offset,
		genres.join(','),
		minRating,
		maxRating,
		minYear,
		maxYear,
		sortBy,
		sortOrder,
		includeAdult
	);

	return withCache(cacheKey, CACHE_TTL_SEARCH_SECONDS, async () => {
		try {
			const [results, total] = await Promise.all([
				performSearchQuery({
					query: normalizedQuery,
					limit,
					offset,
					genres,
					minRating,
					maxRating,
					minYear,
					maxYear,
					sortBy,
					sortOrder,
					includeAdult
				}),
				getTotalCount({
					query: normalizedQuery,
					genres,
					minRating,
					maxRating,
					minYear,
					maxYear,
					includeAdult
				})
			]);

			const [genreFacets, yearFacets, ratingFacets, suggestions] = await Promise.all([
				getGenreFacets(genres.map((g) => parseInt(g))),
				getYearFacets(minYear, maxYear),
				getRatingFacets(),
				normalizedQuery.length >= 2 ? getSearchSuggestions(normalizedQuery) : Promise.resolve([])
			]);

			return {
				results,
				total,
				genres: genreFacets,
				years: yearFacets,
				ratings: ratingFacets,
				suggestions
			};
		} catch (error) {
			logger.error({ error, options }, 'Enhanced search failed');
			throw error;
		}
	});
}

async function performSearchQuery(
	options: Omit<SearchOptions, 'offset'> & { offset: number }
): Promise<MovieSummary[]> {
	const {
		query,
		limit,
		offset,
		genres = [],
		minRating,
		maxRating,
		minYear,
		maxYear,
		sortBy,
		sortOrder,
		includeAdult
	} = options;

	try {
		const whereClauses = [];
		const params = [];
		const ftsQuery = query ? createFuzzySearchQuery(query) : null;

		if (ftsQuery) {
			whereClauses.push(`m.numericId IN (
				SELECT rowid FROM movie_fts WHERE movie_fts MATCH ${ftsQuery}
			)`);
		}

		if (genres.length > 0) {
			whereClauses.push(`m.id IN (
				SELECT movieId FROM movies_genres WHERE genreId IN (${genres.join(',')})
			)`);
		}

		if (minRating !== undefined) {
			whereClauses.push('m.rating >= ?');
			params.push(minRating);
		}

		if (maxRating !== undefined) {
			whereClauses.push('m.rating <= ?');
			params.push(maxRating);
		}

		if (minYear !== undefined) {
			whereClauses.push('strftime("%Y", m.releaseDate) >= ?');
			params.push(minYear.toString());
		}

		if (maxYear !== undefined) {
			whereClauses.push('strftime("%Y", m.releaseDate) <= ?');
			params.push(maxYear.toString());
		}

		if (!includeAdult) {
			whereClauses.push('m.is4K = 0');
		}

		const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

		let orderByClause = '';
		switch (sortBy) {
			case 'rating':
				orderByClause = 'ORDER BY (m.rating IS NULL) ASC, m.rating ' + sortOrder;
				break;
			case 'releaseDate':
				orderByClause = 'ORDER BY (m.releaseDate IS NULL) ASC, m.releaseDate ' + sortOrder;
				break;
			case 'title':
				orderByClause = 'ORDER BY m.title COLLATE NOCASE ' + sortOrder;
				break;
			case 'relevance':
			default:
				orderByClause = query
					? 'ORDER BY (SELECT bm25(movie_fts) FROM movie_fts WHERE rowid = m.numericId) ASC'
					: 'ORDER BY (m.rating IS NULL) ASC, m.rating DESC';
		}

		if (sortBy !== 'rating') {
			orderByClause += ', (m.rating IS NULL) ASC, m.rating DESC';
		}
		if (sortBy !== 'releaseDate') {
			orderByClause += ', (m.releaseDate IS NULL) ASC, m.releaseDate DESC';
		}
		if (sortBy !== 'title') {
			orderByClause += ', m.title COLLATE NOCASE ASC';
		}

		let searchSql;
		if (query && ftsQuery) {
			searchSql = sql`
					SELECT m.*
					FROM movie_fts mf
					JOIN movies m ON m.numericId = mf.rowid AND ${whereClause.replace('m.', '')}
					WHERE mf MATCH ${ftsQuery}
					${orderByClause.replace('m.', '').replace('ORDER BY', 'ORDER BY mf.rank,')}
					LIMIT ${limit} OFFSET ${offset}
				`;
		} else {
			searchSql = sql`
					SELECT m.*
					FROM movies m
					${whereClause}
					${orderByClause}
					LIMIT ${limit} OFFSET ${offset}
				`;
		}

		const rows = (await db.all(searchSql)) as any[];
		return await mapRowsToSummaries(rows);
	} catch (error) {
		logger.error({ error, options }, 'Search query failed');
		return [];
	}
}

async function getTotalCount(
	options: Omit<SearchOptions, 'limit' | 'offset' | 'sortBy' | 'sortOrder'>
): Promise<number> {
	const { query, genres = [], minRating, maxRating, minYear, maxYear, includeAdult } = options;

	try {
		const whereClauses = [];
		const params = [];

		if (query) {
			const ftsQuery = createFuzzySearchQuery(query);
			if (ftsQuery) {
				whereClauses.push(`m.numericId IN (
					SELECT rowid FROM movie_fts WHERE movie_fts MATCH ${ftsQuery}
				)`);
			}
		}

		if (genres.length > 0) {
			whereClauses.push(`m.id IN (
				SELECT movieId FROM movies_genres WHERE genreId IN (${genres.join(',')})
			)`);
		}

		if (minRating !== undefined) {
			whereClauses.push('m.rating >= ?');
			params.push(minRating);
		}

		if (maxRating !== undefined) {
			whereClauses.push('m.rating <= ?');
			params.push(maxRating);
		}

		if (minYear !== undefined) {
			whereClauses.push('strftime("%Y", m.releaseDate) >= ?');
			params.push(minYear.toString());
		}

		if (maxYear !== undefined) {
			whereClauses.push('strftime("%Y", m.releaseDate) <= ?');
			params.push(maxYear.toString());
		}

		if (!includeAdult) {
			whereClauses.push('m.is4K = 0');
		}

		const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

		const countSql = sql`
			SELECT COUNT(*) as count
			FROM movies m
			${whereClause}
		`;

		const result = (await db.all(countSql)) as any[];
		return result[0]?.count || 0;
	} catch (error) {
		logger.error({ error, options }, 'Count query failed');
		return 0;
	}
}

export async function autocompleteSearch(query: string): Promise<AutocompleteResult> {
	const normalizedQuery = normalizeQuery(query);

	if (normalizedQuery.length < 2) {
		return {
			suggestions: [],
			movies: [],
			people: []
		};
	}

	const cacheKey = buildCacheKey('autocomplete', normalizedQuery);

	return withCache(cacheKey, CACHE_TTL_SEARCH_SECONDS, async () => {
		try {
			const [suggestions, movies, people] = await Promise.all([
				getSearchSuggestions(normalizedQuery, AUTOCOMPLETE_LIMIT),
				getAutocompleteMovies(normalizedQuery, AUTOCOMPLETE_LIMIT),
				getAutocompletePeople(normalizedQuery, AUTOCOMPLETE_LIMIT)
			]);

			return {
				suggestions,
				movies,
				people
			};
		} catch (error) {
			logger.error({ error, query }, 'Autocomplete search failed');
			return {
				suggestions: [],
				movies: [],
				people: []
			};
		}
	});
}

async function getAutocompleteMovies(query: string, limit: number): Promise<MovieSummary[]> {
	try {
		const ftsQuery = createAutocompleteQuery(query);
		const searchSql = sql`
			SELECT m.*
			FROM movie_fts mf
			JOIN movies m ON m.numericId = mf.rowid
			WHERE mf MATCH ${ftsQuery}
			ORDER BY bm25(mf) ASC
			LIMIT ${limit}
		`;

		const rows = (await db.all(searchSql)) as any[];
		return await mapRowsToSummaries(rows);
	} catch (error) {
		logger.error({ error, query }, 'Autocomplete movies failed');
		return [];
	}
}

export async function getSearchHistory(
	userId?: string
): Promise<Array<{ query: string; timestamp: number }>> {
	try {
		if (userId) {
			const results = await db.all(sql`
				SELECT query, searchedAt as timestamp
				FROM search_history
				WHERE userId = ${userId}
				ORDER BY searchedAt DESC
				LIMIT 10
			`);
			return results.map((row: any) => ({
				query: row.query as string,
				timestamp: row.timestamp as number
			}));
		} else {
			const results = await db.all(sql`
				SELECT query, COUNT(*) as count
				FROM search_history
				GROUP BY query
				ORDER BY count DESC
				LIMIT 10
			`);
			return results.map((row: any) => ({
				query: row.query as string,
				timestamp: Date.now()
			}));
		}
	} catch (error) {
		logger.error({ error, userId }, 'Failed to get search history');
		return [];
	}
}

export async function saveSearchHistory(userId: string, query: string): Promise<void> {
	try {
		const normalizedQuery = normalizeQuery(query);
		if (!normalizedQuery) return;

		await db.run(sql`
			INSERT INTO search_history (userId, query, searchedAt)
			VALUES (${userId}, ${normalizedQuery}, ${Date.now()})
		`);
	} catch (error) {
		logger.error({ error, userId, query }, 'Failed to save search history');
	}
}

export async function getPersonalizedRecommendations(
	userId: string,
	limit: number = 10
): Promise<MovieSummary[]> {
	try {
		const [watchHistory, watchlist] = await Promise.all([
			db.all(sql`
				SELECT movieData
				FROM watch_history
				WHERE userId = ${userId}
				ORDER BY watchedAt DESC
				LIMIT 20
			`),
			db.all(sql`
				SELECT movieData
				FROM watchlist
				WHERE userId = ${userId}
				LIMIT 20
			`)
		]);

		const allMovies = [...watchHistory, ...watchlist];
		const genrePreferences: Record<number, number> = {};

		for (const item of allMovies) {
			try {
				const movieData = JSON.parse((item as any).movieData as string);
				if (movieData.genres) {
					for (const genre of movieData.genres) {
						genrePreferences[genre.id] = (genrePreferences[genre.id] || 0) + 1;
					}
				}
			} catch {
				// Ignore
			}
		}

		const preferredGenreIds = Object.entries(genrePreferences)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([id]) => parseInt(id));

		if (preferredGenreIds.length === 0) {
			const popularMovies = (await db.all(sql`
			SELECT m.*
			FROM movies m
			ORDER BY (m.rating IS NULL) ASC, m.rating DESC, m.popularity DESC
			LIMIT ${limit}
		`)) as any[];
			return await mapRowsToSummaries(popularMovies);
		}

		const recommendedMovies = await db.all(sql`
			SELECT m.*
			FROM movies m
			JOIN movies_genres mg ON m.id = mg.movieId
			WHERE mg.genreId IN (${preferredGenreIds.join(',')})
			ORDER BY (m.rating IS NULL) ASC, m.rating DESC, m.popularity DESC
			LIMIT ${limit}
		`);

		return await mapRowsToSummaries(recommendedMovies as any[]);
	} catch (error) {
		logger.error({ error, userId }, 'Failed to get personalized recommendations');
		const popularMovies = await db.all(sql`
			SELECT m.*
			FROM movies m
			ORDER BY (m.rating IS NULL) ASC, m.rating DESC, m.popularity DESC
			LIMIT ${limit}
		`);
		return await mapRowsToSummaries(popularMovies as any[]);
	}
}
