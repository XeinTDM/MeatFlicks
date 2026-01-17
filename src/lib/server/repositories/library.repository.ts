import { db } from '$lib/server/db';
import { media, collections, genres, mediaGenres, watchHistory } from '$lib/server/db/schema';
import { eq, and, isNotNull, desc, asc, sql, gte, lte, inArray, or } from 'drizzle-orm';
import type { CollectionRecord, GenreRecord, MediaRow, MediaSummary } from '$lib/server/db';
import { mapRowsToSummaries, getGenreNameMap } from '$lib/server/db/movie-select';
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

export type CollectionWithMovies = CollectionRecord & { movies: MediaSummary[] };

export const libraryRepository = {
	async findTrendingMovies(
		limit = 20,
		mediaType: 'movie' | 'tv' | 'anime' = 'movie'
	): Promise<MediaSummary[]> {
		const take = toPositiveInteger(limit, 20);

		try {
			const cacheKey = buildCacheKey('media', 'trending', mediaType, take);
			return await withCache<MediaSummary[]>(cacheKey, CACHE_TTL_SHORT_SECONDS, async () => {
				const rows = await db
					.select()
					.from(media)
					.where(and(isNotNull(media.rating), eq(media.mediaType, mediaType)))
					.orderBy(desc(media.rating), desc(media.releaseDate), asc(media.title))
					.limit(take);
				return await mapRowsToSummaries(rows as MediaRow[]);
			});
		} catch (error) {
			console.error('Error fetching trending media:', error);
			throw new Error('Failed to fetch trending media');
		}
	},

	async findMoviesByIds(ids: string[]): Promise<MediaSummary[]> {
		if (ids.length === 0) return [];
		try {
			const rows = await db.select().from(media).where(inArray(media.id, ids));
			return await mapRowsToSummaries(rows as MediaRow[]);
		} catch (error) {
			console.error('Error fetching media by ids:', error);
			throw new Error('Failed to fetch media by ids');
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
						.from(media)
						.where(eq(media.collectionId, collectionResults.id))
						.orderBy(desc(media.rating), desc(media.releaseDate), asc(media.title))
						.offset(skip);

					if (take !== undefined) {
						moviesQuery.limit(take);
					}

					const movieRows = await moviesQuery;

					return {
						...collectionResults,
						movies: await mapRowsToSummaries(movieRows as MediaRow[])
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
	): Promise<MediaSummary[]> {
		const take = typeof limit === 'number' ? toPositiveInteger(limit, 20) : 20;
		const skip = normalizeOffset(offset);

		try {
			const cacheKey = buildCacheKey('media', 'collection', collectionSlug, take, skip);
			return await withCache<MediaSummary[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				const rows = await db
					.select({ media })
					.from(media)
					.innerJoin(collections, eq(media.collectionId, collections.id))
					.where(eq(collections.slug, collectionSlug))
					.orderBy(desc(media.rating), desc(media.releaseDate), asc(media.title))
					.limit(take)
					.offset(skip);

				return await mapRowsToSummaries(rows.map((r) => r.media) as MediaRow[]);
			});
		} catch (error) {
			console.error('Error fetching media for collection ' + collectionSlug + ':', error);
			throw new Error('Failed to fetch media for collection ' + collectionSlug);
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
	): Promise<MediaSummary[]> {
		const take = typeof limit === 'number' ? toPositiveInteger(limit, 20) : 20;
		const skip = normalizeOffset(offset);
		const normalizedGenre = genreName.trim().toLowerCase();

		try {
			const cacheKey = buildCacheKey(
				'media',
				'genre',
				mediaType,
				normalizedGenre,
				take,
				skip,
				include_anime
			);
			return await withCache<MediaSummary[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				const idMap = await getGenreNameMap();
				const genreId = idMap.get(normalizedGenre);

				if (!genreId) return [];

				let mediaTypeCondition;
				if (include_anime === 'only') {
					mediaTypeCondition = eq(media.mediaType, 'anime');
				} else if (include_anime === 'exclude') {
					mediaTypeCondition = eq(media.mediaType, mediaType);
				} else {
					mediaTypeCondition = or(eq(media.mediaType, mediaType), eq(media.mediaType, 'anime'));
				}

				const rows = await db
					.select({ media })
					.from(media)
					.innerJoin(mediaGenres, eq(mediaGenres.mediaId, media.id))
					.where(and(eq(mediaGenres.genreId, genreId), mediaTypeCondition))
					.orderBy(desc(media.rating), desc(media.releaseDate), asc(media.title))
					.limit(take)
					.offset(skip);

				const mediaRows = rows.map((r) => r.media);
				return await mapRowsToSummaries(mediaRows as MediaRow[]);
			});
		} catch (error) {
			console.error('Error fetching media for genre ' + genreName + ':', error);
			throw new Error('Failed to fetch media for genre ' + genreName);
		}
	},

	applyFilters(
		query: any,
		conditions: any[],
		filters: MovieFilters,
		idMap: Map<string, number>,
		mediaType: 'movie' | 'tv' = 'movie',
		include_anime:
			| 'include'
			| 'exclude'
			| 'only'
			| 'include_anime'
			| 'exclude_anime'
			| 'only_anime' = 'include'
	) {
		let mediaTypeCondition;
		const animeMode = (include_anime as string).includes('anime')
			? (include_anime as string).split('_')[0]
			: include_anime;

		if (animeMode === 'only') {
			mediaTypeCondition = eq(media.mediaType, 'anime');
		} else if (animeMode === 'exclude') {
			mediaTypeCondition = eq(media.mediaType, mediaType);
		} else {
			mediaTypeCondition = or(eq(media.mediaType, mediaType), eq(media.mediaType, 'anime'));
		}
		conditions.push(mediaTypeCondition);

		if (filters.yearFrom) {
			conditions.push(gte(media.releaseDate, `${filters.yearFrom}-01-01`));
		}
		if (filters.yearTo) {
			conditions.push(lte(media.releaseDate, `${filters.yearTo}-12-31`));
		}

		if (filters.minRating !== undefined) {
			conditions.push(gte(media.rating, filters.minRating));
		}
		if (filters.maxRating !== undefined) {
			conditions.push(lte(media.rating, filters.maxRating));
		}

		if (filters.runtimeMin !== undefined) {
			conditions.push(gte(media.durationMinutes, filters.runtimeMin));
		}
		if (filters.runtimeMax !== undefined) {
			conditions.push(lte(media.durationMinutes, filters.runtimeMax));
		}

		if (filters.language) {
			conditions.push(eq(media.language, filters.language));
		}

		if (filters.genres && filters.genres.length > 0) {
			const genreIds = filters.genres
				.map((name) => idMap.get(name.toLowerCase()))
				.filter((id): id is number => id !== undefined);

			if (genreIds.length > 0) {
				const genreMode = filters.genreMode || 'OR';

				if (genreMode === 'AND') {
					const genreCount = genreIds.length;
					query = query.innerJoin(mediaGenres, eq(mediaGenres.mediaId, media.id));

					conditions.push(inArray(mediaGenres.genreId, genreIds));
					query = (query as any)
						.groupBy(media.numericId)
						.having(sql`count(DISTINCT ${mediaGenres.genreId}) = ${genreCount}`);
				} else {
					query = query.innerJoin(mediaGenres, eq(mediaGenres.mediaId, media.id));
					conditions.push(inArray(mediaGenres.genreId, genreIds));
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
	): Promise<PaginatedResult<MediaSummary>> {
		try {
			const idMap = await getGenreNameMap();
			const offset = calculateOffset(pagination.page, pagination.pageSize);
			const orderByClause = this.buildOrderByClause(sort);

			const createBaseQuery = (base: any) => {
				const conditions: any[] = [];
				return this.applyFilters(base, conditions, filters, idMap, mediaType, include_anime);
			};

			const countBase = createBaseQuery(
				db.select({ count: sql<number>`count(DISTINCT ${media.id})` }).from(media)
			);
			const itemsBase = createBaseQuery(db.select({ media }).from(media));

			const [totalItemsRes, rows] = await db.batch([
				countBase,
				(itemsBase as any)
					.orderBy(...orderByClause)
					.limit(pagination.pageSize)
					.offset(offset)
			]);

			const totalItems = totalItemsRes[0]?.count || 0;
			const mediaRows = rows.map((r: any) => r.media);
			const items = await mapRowsToSummaries(mediaRows as MediaRow[]);

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
			console.error('Error finding media with filters:', error);
			throw new Error('Failed to find media with filters');
		}
	},

	async countMoviesWithFilters(
		filters: MovieFilters,
		mediaType: 'movie' | 'tv' = 'movie',
		include_anime: 'include' | 'exclude' | 'only' = 'include'
	): Promise<number> {
		try {
			const idMap = await getGenreNameMap();
			let countQuery = db.select({ count: sql<number>`count(DISTINCT ${media.id})` }).from(media);
			const conditions: any[] = [];

			countQuery = this.applyFilters(
				countQuery,
				conditions,
				filters,
				idMap,
				mediaType,
				include_anime
			);

			const result = await countQuery;
			return result[0]?.count || 0;
		} catch (error) {
			console.error('Error counting media with filters:', error);
			return 0;
		}
	},

	buildOrderByClause(sort: SortOptions): any[] {
		const orderFn = sort.order === 'asc' ? asc : desc;

		switch (sort.field) {
			case 'popularity':
				return [orderFn(media.popularity), desc(media.rating), asc(media.title)];
			case 'rating':
				return [orderFn(media.rating), desc(media.releaseDate), asc(media.title)];
			case 'releaseDate':
				return [orderFn(media.releaseDate), desc(media.rating), asc(media.title)];
			case 'title':
				return [orderFn(media.title)];
			case 'runtime':
				return [orderFn(media.durationMinutes), desc(media.rating), asc(media.title)];
			default:
				return [desc(media.rating), desc(media.releaseDate), asc(media.title)];
		}
	},

	async getWatchHistory(userId: string, limit = 20): Promise<MediaSummary[]> {
		try {
			const rows = await db
				.select({ media })
				.from(watchHistory)
				.innerJoin(media, eq(watchHistory.mediaId, media.id))
				.where(eq(watchHistory.userId, userId))
				.orderBy(desc(watchHistory.watchedAt))
				.limit(limit);

			const mediaRows = rows.map((r) => r.media);
			return await mapRowsToSummaries(mediaRows as MediaRow[]);
		} catch (error) {
			console.error('Error fetching watch history:', error);
			return [];
		}
	},

	async addToWatchHistory(userId: string, mediaId: string): Promise<void> {
		try {
			await db.insert(watchHistory).values({
				userId,
				mediaId,
				watchedAt: Date.now()
			});
		} catch (error) {
			console.error('Error adding to watch history:', error);
		}
	},

	async clearWatchHistory(userId: string): Promise<void> {
		try {
			await db.delete(watchHistory).where(eq(watchHistory.userId, userId));
		} catch (error) {
			console.error('Error clearing watch history:', error);
		}
	}
};

export type LibraryRepository = typeof libraryRepository;
