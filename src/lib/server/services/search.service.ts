import { db } from '$lib/server/db';
import { sql, SQL } from 'drizzle-orm';
import { mapRowsToSummaries } from '$lib/server/db/movie-select';
import {
	withCache,
	buildCacheKey,
	CACHE_TTL_SEARCH_SECONDS,
	CACHE_TTL_LONG_SECONDS,
	CACHE_TTL_MEDIUM_SECONDS
} from '$lib/server/cache';
import { logger } from '$lib/server/logger';
import type { MediaSummary, MediaRow } from '$lib/server/db';

interface SearchOptions {
	query?: string;
	limit?: number;
	offset?: number;
	genres?: string[];
	minRating?: number;
	maxRating?: number;
	minYear?: number;
	maxYear?: number;
	runtimeMin?: number;
	runtimeMax?: number;
	language?: string;
	mediaType?: 'movie' | 'tv' | 'anime';
	sortBy?: 'relevance' | 'rating' | 'releaseDate' | 'title';
	sortOrder?: 'asc' | 'desc';
	includeAdult?: boolean;
}

type SanitizedSearchOptions = Omit<
	SearchOptions,
	'limit' | 'offset' | 'sortBy' | 'sortOrder' | 'genres' | 'includeAdult' | 'query'
> & {
	limit: number;
	offset: number;
	sortBy: SearchOptions['sortBy'];
	sortOrder: SearchOptions['sortOrder'];
	genres: string[];
	includeAdult: boolean;
	query: string;
};

interface SearchResult {
	results: MediaSummary[];
	total: number;
	genres: { id: number; name: string; count: number }[];
	years: { year: number; count: number }[];
	ratings: { rating: number; count: number }[];
	suggestions: string[];
}

interface AutocompleteResult {
	suggestions: string[];
	movies: MediaSummary[];
	people: Array<{ id: number; name: string; type: 'actor' | 'director' }>;
}

const DEFAULT_LIMIT = 20;
const AUTOCOMPLETE_LIMIT = 10;
const MAX_LIMIT = 100;
const SORT_BY_LOOKUP: Record<string, SearchOptions['sortBy']> = {
	relevance: 'relevance',
	rating: 'rating',
	releasedate: 'releaseDate',
	title: 'title'
};
const SORT_ORDER_VALUES: SearchOptions['sortOrder'][] = ['asc', 'desc'];
const MEDIA_TYPE_LOOKUP: Record<string, SearchOptions['mediaType']> = {
	movie: 'movie',
	tv: 'tv',
	anime: 'anime'
};

function sanitizeGenres(genres?: SearchOptions['genres']): string[] {
	if (!Array.isArray(genres) || genres.length === 0) {
		return [];
	}

	const unique: string[] = [];
	const seen = new Set<string>();

	for (const raw of genres) {
		const trimmed = `${raw ?? ''}`.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		unique.push(trimmed);
		if (unique.length >= 25) break;
	}

	return unique;
}

function sanitizeLimit(value?: number): number {
	if (!Number.isFinite(value ?? NaN)) {
		return DEFAULT_LIMIT;
	}

	return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value!)));
}

function sanitizeOffset(value?: number): number {
	if (!Number.isFinite(value ?? NaN)) {
		return 0;
	}

	return Math.max(0, Math.floor(value!));
}

function sanitizeSortBy(value?: string): SearchOptions['sortBy'] {
	if (!value) {
		return 'relevance';
	}

	const normalized = value.trim().toLowerCase();
	return SORT_BY_LOOKUP[normalized] ?? 'relevance';
}

function sanitizeSortOrder(value?: string): SearchOptions['sortOrder'] {
	const normalized = (value ?? '').trim().toLowerCase();
	return SORT_ORDER_VALUES.includes(normalized as SearchOptions['sortOrder'])
		? (normalized as SearchOptions['sortOrder'])
		: 'desc';
}

function sanitizeMediaType(value?: string): SearchOptions['mediaType'] | undefined {
	if (!value) {
		return undefined;
	}

	const normalized = value.trim().toLowerCase();
	return MEDIA_TYPE_LOOKUP[normalized] ?? undefined;
}

function sanitizeLanguage(value?: string): string | undefined {
	if (!value) {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

function sanitizeIncludeAdult(value?: boolean): boolean {
	return Boolean(value);
}

function sanitizeQuery(value?: string): string {
	if (!value) {
		return '';
	}

	return value.trim();
}

function sanitizeSearchOptions(options: SearchOptions): SanitizedSearchOptions {
	const sanitized: SanitizedSearchOptions = {
		...options,
		genres: sanitizeGenres(options.genres),
		limit: sanitizeLimit(options.limit),
		offset: sanitizeOffset(options.offset),
		sortBy: sanitizeSortBy(options.sortBy),
		sortOrder: sanitizeSortOrder(options.sortOrder),
		mediaType: sanitizeMediaType(options.mediaType),
		language: sanitizeLanguage(options.language),
		includeAdult: sanitizeIncludeAdult(options.includeAdult),
		query: sanitizeQuery(options.query)
	};

	return sanitized;
}

interface SearchFilterResult {
	whereClause: SQL;
	clauseForFts: SQL;
	filterKey: string;
	ftsQuery: string | null;
	hasFilters: boolean;
}

function normalizeGenreTokens(genres: string[] = []): { ids: number[]; names: string[] } {
	const idSet = new Set<number>();
	const nameSet = new Set<string>();

	for (const raw of genres) {
		const trimmed = `${raw ?? ''}`.trim();
		if (!trimmed) continue;

		const parsedNumber = Number(trimmed);
		if (Number.isFinite(parsedNumber)) {
			idSet.add(Math.floor(Math.abs(parsedNumber)));
		} else {
			nameSet.add(trimmed);
		}
	}

	return {
		ids: [...idSet],
		names: [...nameSet]
	};
}

function buildSearchFilters(options: SearchOptions): SearchFilterResult {
	const {
		query = '',
		genres = [],
		minRating,
		maxRating,
		minYear,
		maxYear,
		runtimeMin,
		runtimeMax,
		language,
		mediaType,
		includeAdult = false
	} = options;

	const normalizedQuery = query ?? '';
	const genreTokens = normalizeGenreTokens(genres);
	const clauses: SQL[] = [];
	const keyParts: string[] = [];

	const pushKey = (label: string, value: unknown) => {
		if (value === undefined || value === null || value === '') return;
		keyParts.push(`${label}:${value}`);
	};

	pushKey('q', normalizedQuery);

	if (genreTokens.ids.length > 0) {
		pushKey('genreIds', genreTokens.ids.join(','));
	} else if (!genreTokens.names.length) {
		keyParts.push('genre:none');
	}

	if (genreTokens.names.length > 0) {
		pushKey('genreNames', genreTokens.names.join(','));
	}

	if (Number.isFinite(minRating ?? NaN)) {
		clauses.push(sql`m.rating >= ${minRating}`);
		pushKey('minRating', minRating);
	}

	if (Number.isFinite(maxRating ?? NaN)) {
		clauses.push(sql`m.rating <= ${maxRating}`);
		pushKey('maxRating', maxRating);
	}

	if (Number.isFinite(minYear ?? NaN)) {
		const sanitized = Math.floor(minYear as number);
		clauses.push(sql`strftime('%Y', m.releaseDate) >= ${String(sanitized)}`);
		pushKey('minYear', sanitized);
	}

	if (Number.isFinite(maxYear ?? NaN)) {
		const sanitized = Math.floor(maxYear as number);
		clauses.push(sql`strftime('%Y', m.releaseDate) <= ${String(sanitized)}`);
		pushKey('maxYear', sanitized);
	}

	if (Number.isFinite(runtimeMin ?? NaN)) {
		clauses.push(sql`m.durationMinutes >= ${runtimeMin}`);
		pushKey('runtimeMin', runtimeMin);
	}

	if (Number.isFinite(runtimeMax ?? NaN)) {
		clauses.push(sql`m.durationMinutes <= ${runtimeMax}`);
		pushKey('runtimeMax', runtimeMax);
	}

	if (language?.trim()) {
		const sanitized = language.trim();
		clauses.push(sql`m.language = ${sanitized}`);
		pushKey('language', sanitized);
	}

	if (mediaType) {
		clauses.push(sql`m.mediaType = ${mediaType}`);
		pushKey('mediaType', mediaType);
	}

	pushKey('includeAdult', includeAdult);
	if (!includeAdult) {
		clauses.push(sql`m.is4K = 0`);
	}

	if (genreTokens.ids.length > 0 || genreTokens.names.length > 0) {
		const genreConditions: SQL[] = [];
		for (const id of genreTokens.ids) {
			genreConditions.push(sql`mg.genreId = ${id}`);
		}
		for (const name of genreTokens.names) {
			genreConditions.push(sql`g.name = ${name}`);
		}

		if (genreConditions.length > 0) {
			clauses.push(
				sql`
					m.id IN (
						SELECT mg.mediaId
						FROM media_genres mg
						JOIN genres g ON g.id = mg.genreId
						WHERE ${sql.join(genreConditions, sql` OR `)}
					)
				`
			);
		}
	}

	const combinedConditions = clauses.length > 0 ? sql`${sql.join(clauses, sql` AND `)}` : null;
	const whereClause = combinedConditions ? sql`WHERE ${combinedConditions}` : sql``;

	return {
		whereClause,
		clauseForFts: combinedConditions ?? sql``,
		filterKey: keyParts.filter(Boolean).join('|'),
		ftsQuery: normalizedQuery ? createFuzzySearchQuery(normalizedQuery) : null,
		hasFilters: clauses.length > 0
	};
}
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
	filters: SearchFilterResult
): Promise<{ id: number; name: string; count: number }[]> {
	const cacheKey = buildCacheKey('search', 'facets', 'genres', filters.filterKey);
	return withCache(cacheKey, CACHE_TTL_SEARCH_SECONDS, async () => {
		try {
			const results = await db.all(sql`
				SELECT g.id, g.name, COUNT(DISTINCT m.id) as count
				FROM genres g
				JOIN media_genres mg ON g.id = mg.genreId
				JOIN media m ON mg.mediaId = m.id
				${filters.whereClause}
				GROUP BY g.id, g.name
				HAVING count > 0
				ORDER BY count DESC, g.name ASC
				LIMIT 15
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
	});
}

async function getYearFacets(
	filters: SearchFilterResult
): Promise<{ year: number; count: number }[]> {
	const cacheKey = buildCacheKey('search', 'facets', 'years', filters.filterKey);
	return withCache(cacheKey, CACHE_TTL_SEARCH_SECONDS, async () => {
		try {
			const baseWhere = filters.hasFilters ? filters.whereClause : sql`WHERE 1=1`;
			const results = await db.all(sql`
				SELECT strftime('%Y', m.releaseDate) as year, COUNT(*) as count
				FROM media m
				${baseWhere} AND m.releaseDate IS NOT NULL
				GROUP BY year
				ORDER BY year DESC
				LIMIT 15
			`);

			return results
				.map((row: any) => ({
					year: parseInt(row.year as string),
					count: row.count as number
				}))
				.filter((item: { year: number; count: number }) => !isNaN(item.year));
		} catch (error) {
			logger.error({ error }, 'Failed to get year facets');
			return [];
		}
	});
}

async function getRatingFacets(
	filters: SearchFilterResult
): Promise<{ rating: number; count: number }[]> {
	const cacheKey = buildCacheKey('search', 'facets', 'ratings', filters.filterKey);
	return withCache(cacheKey, CACHE_TTL_SEARCH_SECONDS, async () => {
		try {
			const baseWhere = filters.hasFilters ? filters.whereClause : sql`WHERE 1=1`;
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
				FROM media m
				${baseWhere} AND m.rating IS NOT NULL
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
	});
}

async function getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
	if (!query || query.length < 2) return [];

	try {
		const ftsQuery = createAutocompleteQuery(query);
		const results = await db.all(sql`
			SELECT DISTINCT m.title
			FROM movie_fts mf
			JOIN media m ON m.numericId = mf.rowid
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
	const sanitizedOptions = sanitizeSearchOptions(options);
	const normalizedQuery = normalizeQuery(sanitizedOptions.query ?? '');
	const searchOptions = {
		...sanitizedOptions,
		query: normalizedQuery
	};

	const filters = buildSearchFilters(searchOptions);
	const facetFilters = buildSearchFilters({
		...searchOptions,
		genres: [],
		mediaType: undefined
	});

	const cacheKey = buildCacheKey(
		'enhanced-search',
		normalizedQuery,
		filters.filterKey,
		searchOptions.limit,
		searchOptions.offset,
		searchOptions.minRating,
		searchOptions.maxRating,
		searchOptions.minYear,
		searchOptions.maxYear,
		searchOptions.runtimeMin,
		searchOptions.runtimeMax,
		searchOptions.language,
		searchOptions.mediaType,
		searchOptions.sortBy,
		searchOptions.sortOrder,
		searchOptions.includeAdult
	);

	return withCache(cacheKey, CACHE_TTL_SEARCH_SECONDS, async () => {
		try {
			const [results, total] = await Promise.all([
				performSearchQuery(
					{
						...searchOptions,
						query: normalizedQuery,
						limit: searchOptions.limit,
						offset: searchOptions.offset,
						sortBy: searchOptions.sortBy,
						sortOrder: searchOptions.sortOrder
					},
					filters
				),
				getTotalCount(searchOptions, filters)
			]);

			const [genreFacets, yearFacets, ratingFacets, suggestions] = await Promise.all([
				getGenreFacets(facetFilters),
				getYearFacets(facetFilters),
				getRatingFacets(facetFilters),
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
	options: Omit<SearchOptions, 'offset'> & {
		offset: number;
		limit?: number;
		sortBy?: 'relevance' | 'rating' | 'releaseDate' | 'title';
		sortOrder?: 'asc' | 'desc';
	},
	filters: SearchFilterResult
): Promise<MediaSummary[]> {
	const {
		limit = DEFAULT_LIMIT,
		offset,
		sortBy = 'relevance',
		sortOrder = 'desc',
		query
	} = options;

	const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

	try {
		let orderByClause = '';
		switch (sortBy) {
			case 'rating':
				orderByClause = 'ORDER BY (m.rating IS NULL) ASC, m.rating ' + sortDirection;
				break;
			case 'releaseDate':
				orderByClause = 'ORDER BY (m.releaseDate IS NULL) ASC, m.releaseDate ' + sortDirection;
				break;
			case 'title':
				orderByClause = 'ORDER BY m.title COLLATE NOCASE ' + sortDirection;
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

		const hasFts = Boolean(query && filters.ftsQuery);
		const ftsOrderClause = orderByClause
			.replace(/m\./g, '')
			.replace('ORDER BY', 'ORDER BY mf.rank,');

		const ftsJoinClause = filters.hasFilters ? sql`AND ${filters.clauseForFts}` : sql``;

		const searchSql = hasFts
			? sql`
					SELECT m.*
					FROM movie_fts mf
					JOIN media m ON m.numericId = mf.rowid
					${ftsJoinClause}
					WHERE mf MATCH ${filters.ftsQuery}
					${sql.raw(ftsOrderClause)}
					LIMIT ${limit} OFFSET ${offset}
				`
			: sql`
					SELECT m.*
					FROM media m
					${filters.whereClause}
					${sql.raw(orderByClause)}
					LIMIT ${limit} OFFSET ${offset}
				`;

		const rows = (await db.all(searchSql)) as any[];
		return await mapRowsToSummaries(rows);
	} catch (error) {
		logger.error({ error, options }, 'Search query failed');
		return [];
	}
}

async function getTotalCount(
	options: Omit<SearchOptions, 'limit' | 'offset' | 'sortBy' | 'sortOrder'>,
	filters: SearchFilterResult
): Promise<number> {
	try {
		const countSql = sql`
			SELECT COUNT(*) as count
			FROM media m
			${filters.whereClause}
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

async function getAutocompleteMovies(query: string, limit: number): Promise<MediaSummary[]> {
	try {
		const ftsQuery = createAutocompleteQuery(query);
		const searchSql = sql`
			SELECT m.*
			FROM movie_fts mf
			JOIN media m ON m.numericId = mf.rowid
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
): Promise<MediaSummary[]> {
	const cacheKey = buildCacheKey('recommendations', userId, limit);
	return withCache(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
		try {
			const genrePrefResults = await db.all(sql`
				WITH CombinedHistory AS (
					SELECT media_id FROM watch_history WHERE userId = ${userId}
					UNION ALL
					SELECT media_id FROM watchlist WHERE userId = ${userId}
				)
				SELECT mg.genreId, COUNT(*) as count
				FROM CombinedHistory ch
				JOIN media_genres mg ON ch.media_id = mg.mediaId
				GROUP BY mg.genreId
				ORDER BY count DESC
				LIMIT 3
			`);

			const preferredGenreIds = genrePrefResults.map((r: any) => r.genreId as number);

			if (preferredGenreIds.length === 0) {
				const popularMovies = (await db.all(sql`
				SELECT m.*
				FROM media m
				ORDER BY (m.rating IS NULL) ASC, m.rating DESC, m.popularity DESC
				LIMIT ${limit}
			`)) as any[];
				return await mapRowsToSummaries(popularMovies as MediaRow[]);
			}

			const recommendedMovies = await db.all(sql`
				SELECT DISTINCT m.*
				FROM media m
				JOIN media_genres mg ON m.id = mg.mediaId
				WHERE mg.genreId IN (${sql.raw(preferredGenreIds.join(','))})
				ORDER BY (m.rating IS NULL) ASC, m.rating DESC, m.popularity DESC
				LIMIT ${limit}
			`);

			return await mapRowsToSummaries(recommendedMovies as any[]);
		} catch (error) {
			logger.error({ error, userId }, 'Failed to get personalized recommendations');
			const popularMovies = await db.all(sql`
				SELECT m.*
				FROM media m
				ORDER BY (m.rating IS NULL) ASC, m.rating DESC, m.popularity DESC
				LIMIT ${limit}
			`);
			return await mapRowsToSummaries(popularMovies as any[]);
		}
	});
}
