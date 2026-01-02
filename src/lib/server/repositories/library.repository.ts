import { db } from '$lib/server/db';
import { movies, collections, genres, moviesGenres } from '$lib/server/db/schema';
import { eq, and, isNotNull, desc, asc, sql, gte, lte, inArray, or } from 'drizzle-orm';
import type { CollectionRecord, GenreRecord, MovieRow, MovieSummary } from '$lib/server/db';
import { mapRowsToSummaries } from '$lib/server/db/movie-select';
import type { MovieFilters, SortOptions } from '$lib/types/filters';
import type { PaginatedResult, PaginationParams } from '$lib/types/pagination';
import { calculatePagination, calculateOffset } from '$lib/types/pagination';
import {
	CACHE_TTL_LONG_SECONDS,
	CACHE_TTL_MEDIUM_SECONDS,
	CACHE_TTL_SHORT_SECONDS,
	buildCacheKey,
	withCache
} from '$lib/server/cache';

const toPositiveInteger = (value: number | undefined, fallback: number): number => {
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
		return fallback;
	}
	return Math.floor(value);
};

const normalizeOffset = (value: number | undefined): number => {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		return 0;
	}
	return Math.floor(value);
};

let genreIdMap: Map<string, number> | null = null;
const getGenreIdMap = async (): Promise<Map<string, number>> => {
	if (genreIdMap) return genreIdMap;
	const allGenres = await db.select().from(genres);
	genreIdMap = new Map(allGenres.map((g) => [g.name.toLowerCase(), g.id]));
	return genreIdMap;
};

export type CollectionWithMovies = CollectionRecord & { movies: MovieSummary[] };

export const libraryRepository = {
	async findTrendingMovies(
		limit = 20,
		mediaType: 'movie' | 'tv' | 'anime' = 'movie'
	): Promise<MovieSummary[]> {
		const take = toPositiveInteger(limit, 20);

		try {
			const cacheKey = buildCacheKey('movies', 'trending', mediaType, take);
			return await withCache<MovieSummary[]>(cacheKey, CACHE_TTL_SHORT_SECONDS, async () => {
				const rows = await db
					.select()
					.from(movies)
					.where(and(isNotNull(movies.rating), eq(movies.mediaType, mediaType)))
					.orderBy(desc(movies.rating), desc(movies.releaseDate), asc(movies.title))
					.limit(take);
				return await mapRowsToSummaries(rows as MovieRow[]);
			});
		} catch (error) {
			console.error('Error fetching trending movies:', error);
			throw new Error('Failed to fetch trending movies');
		}
	},

	async findMoviesByIds(ids: string[]): Promise<MovieSummary[]> {
		if (ids.length === 0) return [];
		try {
			const rows = await db
				.select()
				.from(movies)
				.where(inArray(movies.id, ids));
			return await mapRowsToSummaries(rows as MovieRow[]);
		} catch (error) {
			console.error('Error fetching movies by ids:', error);
			throw new Error('Failed to fetch movies by ids');
		}
	},

	async listCollections(): Promise<CollectionRecord[]> {
		const cacheKey = buildCacheKey('collections', 'all');

		try {
			return await withCache<CollectionRecord[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				return await db.select().from(collections).orderBy(asc(collections.name));
			});
		} catch (error) {
			console.error('Error fetching collections:', error);
			throw new Error('Failed to fetch collections');
		}
	},

	async findCollectionWithMovies(
		collectionSlug: string,
		options: { limit?: number; offset?: number } = {}
	): Promise<CollectionWithMovies | null> {
		const { limit, offset } = options;
		const take = typeof limit === 'number' ? toPositiveInteger(limit, 20) : undefined;
		const skip = normalizeOffset(offset);

		try {
			const cacheKey = buildCacheKey('collections', collectionSlug, take ?? 'all', skip);

			return await withCache<CollectionWithMovies | null>(
				cacheKey,
				CACHE_TTL_LONG_SECONDS,
				async () => {
					const [collectionResults] = await db
						.select()
						.from(collections)
						.where(eq(collections.slug, collectionSlug))
						.limit(1);

					if (!collectionResults) return null;

					const moviesQuery = db
						.select()
						.from(movies)
						.where(eq(movies.collectionId, collectionResults.id))
						.orderBy(desc(movies.rating), desc(movies.releaseDate), asc(movies.title))
						.offset(skip);

					if (take !== undefined) {
						moviesQuery.limit(take);
					}

					const movieRows = await moviesQuery;

					return {
						...collectionResults,
						movies: await mapRowsToSummaries(movieRows as MovieRow[])
					};
				}
			);
		} catch (error) {
			console.error('Error fetching collection ' + collectionSlug + ':', error);
			throw new Error('Failed to fetch collection ' + collectionSlug);
		}
	},

	async findCollectionMovies(
		collectionSlug: string,
		limit?: number,
		offset?: number
	): Promise<MovieSummary[]> {
		const take = typeof limit === 'number' ? toPositiveInteger(limit, 20) : 20;
		const skip = normalizeOffset(offset);

		try {
			const cacheKey = buildCacheKey('movies', 'collection', collectionSlug, take, skip);
			return await withCache<MovieSummary[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				const rows = await db
					.select({ movies })
					.from(movies)
					.innerJoin(collections, eq(movies.collectionId, collections.id))
					.where(eq(collections.slug, collectionSlug))
					.orderBy(desc(movies.rating), desc(movies.releaseDate), asc(movies.title))
					.limit(take)
					.offset(skip);

				return await mapRowsToSummaries(rows.map((r) => r.movies) as MovieRow[]);
			});
		} catch (error) {
			console.error('Error fetching movies for collection ' + collectionSlug + ':', error);
			throw new Error('Failed to fetch movies for collection ' + collectionSlug);
		}
	},

	async listGenres(): Promise<GenreRecord[]> {
		const cacheKey = buildCacheKey('genres', 'all');

		try {
			return await withCache<GenreRecord[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				return await db.select().from(genres).orderBy(asc(genres.name));
			});
		} catch (error) {
			console.error('Error fetching genres:', error);
			throw new Error('Failed to fetch genres');
		}
	},

	async findGenreByName(genreName: string): Promise<GenreRecord | null> {
		try {
			const results = await db.select().from(genres).where(eq(genres.name, genreName)).limit(1);
			return results[0] ?? null;
		} catch (error) {
			console.error('Error fetching genre ' + genreName + ':', error);
			throw new Error('Failed to fetch genre ' + genreName);
		}
	},

	async findGenreMovies(
		genreName: string,
		limit?: number,
		offset?: number,
		mediaType: 'movie' | 'tv' = 'movie',
		include_anime: 'include' | 'exclude' | 'only' = 'include'
	): Promise<MovieSummary[]> {
		const take = typeof limit === 'number' ? toPositiveInteger(limit, 20) : 20;
		const skip = normalizeOffset(offset);
		const normalizedGenre = genreName.trim().toLowerCase();

		try {
			const cacheKey = buildCacheKey(
				'movies',
				'genre',
				mediaType,
				normalizedGenre,
				take,
				skip,
				include_anime
			);
			return await withCache<MovieSummary[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				const idMap = await getGenreIdMap();
				const genreId = idMap.get(normalizedGenre);

				if (!genreId) return [];

				let mediaTypeCondition;
				if (include_anime === 'only') {
					mediaTypeCondition = eq(movies.mediaType, 'anime');
				} else if (include_anime === 'exclude') {
					mediaTypeCondition = eq(movies.mediaType, mediaType);
				} else {
					mediaTypeCondition = or(eq(movies.mediaType, mediaType), eq(movies.mediaType, 'anime'));
				}

				const rows = await db
					.select({ movies })
					.from(movies)
					.innerJoin(moviesGenres, eq(moviesGenres.movieId, movies.id))
					.where(and(eq(moviesGenres.genreId, genreId), mediaTypeCondition))
					.orderBy(desc(movies.rating), desc(movies.releaseDate), asc(movies.title))
					.limit(take)
					.offset(skip);

				const movieRows = rows.map((r) => r.movies);
				return await mapRowsToSummaries(movieRows as MovieRow[]);
			});
		} catch (error) {
			console.error('Error fetching movies for genre ' + genreName + ':', error);
			throw new Error('Failed to fetch movies for genre ' + genreName);
		}
	},

	async applyFilters(
		query: any,
		conditions: any[],
		filters: MovieFilters,
		mediaType: 'movie' | 'tv' = 'movie',
		include_anime: 'include_anime' | 'exclude_anime' | 'only_anime' | 'include' | 'exclude' | 'only' = 'include'
	) {
		let mediaTypeCondition;
		const animeMode = (include_anime as string).includes('anime')
			? (include_anime as string).split('_')[0]
			: include_anime;

		if (animeMode === 'only') {
			mediaTypeCondition = eq(movies.mediaType, 'anime');
		} else if (animeMode === 'exclude') {
			mediaTypeCondition = eq(movies.mediaType, mediaType);
		} else {
			mediaTypeCondition = or(eq(movies.mediaType, mediaType), eq(movies.mediaType, 'anime'));
		}
		conditions.push(mediaTypeCondition);

		if (filters.yearFrom) {
			conditions.push(gte(movies.releaseDate, `${filters.yearFrom}-01-01`));
		}
		if (filters.yearTo) {
			conditions.push(lte(movies.releaseDate, `${filters.yearTo}-12-31`));
		}

		if (filters.minRating !== undefined) {
			conditions.push(gte(movies.rating, filters.minRating));
		}
		if (filters.maxRating !== undefined) {
			conditions.push(lte(movies.rating, filters.maxRating));
		}

		if (filters.runtimeMin !== undefined) {
			conditions.push(gte(movies.durationMinutes, filters.runtimeMin));
		}
		if (filters.runtimeMax !== undefined) {
			conditions.push(lte(movies.durationMinutes, filters.runtimeMax));
		}

		if (filters.language) {
			conditions.push(eq(movies.language, filters.language));
		}

		if (filters.genres && filters.genres.length > 0) {
			const idMap = await getGenreIdMap();
			const genreIds = filters.genres
				.map((name) => idMap.get(name.toLowerCase()))
				.filter((id): id is number => id !== undefined);

			if (genreIds.length > 0) {
				const genreMode = filters.genreMode || 'OR';

				if (genreMode === 'AND') {
					const genreCount = genreIds.length;
					query = query.innerJoin(moviesGenres, eq(moviesGenres.movieId, movies.id));

					conditions.push(inArray(moviesGenres.genreId, genreIds));
					query = (query as any)
						.groupBy(movies.numericId)
						.having(sql`count(DISTINCT ${moviesGenres.genreId}) = ${genreCount}`);
				} else {
					query = query.innerJoin(moviesGenres, eq(moviesGenres.movieId, movies.id));
					conditions.push(inArray(moviesGenres.genreId, genreIds));
				}
			}
		}

		return query.where(and(...conditions));
	},

	async findMoviesWithFilters(
		filters: MovieFilters,
		sort: SortOptions,
		pagination: PaginationParams,
		mediaType: 'movie' | 'tv' = 'movie',
		include_anime: 'include' | 'exclude' | 'only' = 'include'
	): Promise<PaginatedResult<MovieSummary>> {
		try {
			const offset = calculateOffset(pagination.page, pagination.pageSize);

			const [totalItems, rows] = await Promise.all([
				this.countMoviesWithFilters(filters, mediaType, include_anime),
				(async () => {
					let query = db.select({ movies }).from(movies);
					const conditions: any[] = [];
					query = await this.applyFilters(query, conditions, filters, mediaType, include_anime);
					const orderByClause = this.buildOrderByClause(sort);
					query = (query as any).orderBy(...orderByClause);
					return await query.limit(pagination.pageSize).offset(offset);
				})()
			]);

			const movieRows = rows.map((r: any) => r.movies);
			const items = await mapRowsToSummaries(movieRows as MovieRow[]);

			const paginationMetadata = calculatePagination(
				pagination.page,
				pagination.pageSize,
				totalItems
			);

			return {
				items,
				pagination: paginationMetadata
			};
		} catch (error) {
			console.error('Error finding movies with filters:', error);
			throw new Error('Failed to find movies with filters');
		}
	},

	async countMoviesWithFilters(
		filters: MovieFilters,
		mediaType: 'movie' | 'tv' = 'movie',
		include_anime: 'include' | 'exclude' | 'only' = 'include'
	): Promise<number> {
		try {
			let countQuery = db.select({ count: sql<number>`count(DISTINCT ${movies.id})` }).from(movies);
			const conditions: any[] = [];

			countQuery = await this.applyFilters(
				countQuery,
				conditions,
				filters,
				mediaType,
				include_anime
			);

			const result = await countQuery;
			return result[0]?.count || 0;
		} catch (error) {
			console.error('Error counting movies with filters:', error);
			return 0;
		}
	},

	buildOrderByClause(sort: SortOptions): any[] {
		const orderFn = sort.order === 'asc' ? asc : desc;

		switch (sort.field) {
			case 'popularity':
				return [orderFn(movies.popularity), desc(movies.rating), asc(movies.title)];
			case 'rating':
				return [orderFn(movies.rating), desc(movies.releaseDate), asc(movies.title)];
			case 'releaseDate':
				return [orderFn(movies.releaseDate), desc(movies.rating), asc(movies.title)];
			case 'title':
				return [orderFn(movies.title)];
			case 'runtime':
				return [orderFn(movies.durationMinutes), desc(movies.rating), asc(movies.title)];
			default:
				return [desc(movies.rating), desc(movies.releaseDate), asc(movies.title)];
		}
	}
};

export type LibraryRepository = typeof libraryRepository;
