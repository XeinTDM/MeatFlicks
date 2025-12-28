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

export type CollectionWithMovies = CollectionRecord & { movies: MovieSummary[] };

export const libraryRepository = {
	async findTrendingMovies(limit = 20, mediaType: 'movie' | 'tv' | 'anime' = 'movie'): Promise<MovieSummary[]> {
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
					const collectionResults = await db
						.select()
						.from(collections)
						.where(eq(collections.slug, collectionSlug))
						.limit(1);
					const collection = collectionResults[0];
					if (!collection) {
						return null;
					}

					let query = db
						.select()
						.from(movies)
						.where(eq(movies.collectionId, collection.id))
						.orderBy(desc(movies.rating), desc(movies.releaseDate), asc(movies.title))
						.offset(skip);

					if (take !== undefined) {
						query = query.limit(take) as any;
					}

					const rows = await query;
					return { ...collection, movies: await mapRowsToSummaries(rows as MovieRow[]) };
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
				const collectionResults = await db
					.select({ id: collections.id })
					.from(collections)
					.where(eq(collections.slug, collectionSlug))
					.limit(1);
				const collection = collectionResults[0];
				if (!collection) {
					return [];
				}

				const rows = await db
					.select()
					.from(movies)
					.where(eq(movies.collectionId, collection.id))
					.orderBy(desc(movies.rating), desc(movies.releaseDate), asc(movies.title))
					.limit(take)
					.offset(skip);

				return await mapRowsToSummaries(rows as MovieRow[]);
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
		mediaType: 'movie' | 'tv' | 'anime' = 'movie'
	): Promise<MovieSummary[]> {
		const take = typeof limit === 'number' ? toPositiveInteger(limit, 20) : 20;
		const skip = normalizeOffset(offset);
		const normalizedGenre = genreName.trim();

		try {
			const cacheKey = buildCacheKey('movies', 'genre', mediaType, normalizedGenre.toLowerCase(), take, skip);
			return await withCache<MovieSummary[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				const rows = await db
					.select({ movies })
					.from(movies)
					.innerJoin(moviesGenres, eq(moviesGenres.movieId, movies.id))
					.innerJoin(genres, eq(genres.id, moviesGenres.genreId))
					.where(and(eq(genres.name, normalizedGenre), eq(movies.mediaType, mediaType)))
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

	/**
	 * Find movies with advanced filters, sorting, and pagination
	 */
	async findMoviesWithFilters(
		filters: MovieFilters,
		sort: SortOptions,
		pagination: PaginationParams,
		mediaType: 'movie' | 'tv' | 'anime' = 'movie'
	): Promise<PaginatedResult<MovieSummary>> {
		try {
			const offset = calculateOffset(pagination.page, pagination.pageSize);
			const conditions: any[] = [eq(movies.mediaType, mediaType)];

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

			let query = db.select({ movies }).from(movies);

			if (filters.genres && filters.genres.length > 0) {
				const genreMode = filters.genreMode || 'OR';

				if (genreMode === 'AND') {
					for (const genreName of filters.genres) {
						query = query.innerJoin(
							moviesGenres,
							and(
								eq(moviesGenres.movieId, movies.id),
								eq(
									moviesGenres.genreId,
									sql`(SELECT id FROM ${genres} WHERE name = ${genreName} LIMIT 1)`
								)
							)
						) as any;
					}
				} else {
					query = query
						.innerJoin(moviesGenres, eq(moviesGenres.movieId, movies.id))
						.innerJoin(genres, eq(genres.id, moviesGenres.genreId)) as any;

					conditions.push(inArray(genres.name, filters.genres));
				}
			}

			if (conditions.length > 0) {
				query = query.where(and(...conditions)) as any;
			}

			const orderByClause = this.buildOrderByClause(sort);
			query = query.orderBy(...orderByClause) as any;

			const totalItems = await this.countMoviesWithFilters(filters, mediaType);

			query = query.limit(pagination.pageSize).offset(offset) as any;

			const rows = await query;
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

	/**
	 * Count movies matching filters (for pagination)
	 */
	async countMoviesWithFilters(
		filters: MovieFilters,
		mediaType: 'movie' | 'tv' | 'anime' = 'movie'
	): Promise<number> {
		try {
			const conditions: any[] = [eq(movies.mediaType, mediaType)];

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

			let countQuery = db.select({ count: sql<number>`count(DISTINCT ${movies.id})` }).from(movies);

			if (filters.genres && filters.genres.length > 0) {
				const genreMode = filters.genreMode || 'OR';

				if (genreMode === 'OR') {
					countQuery = countQuery
						.innerJoin(moviesGenres, eq(moviesGenres.movieId, movies.id))
						.innerJoin(genres, eq(genres.id, moviesGenres.genreId)) as any;

					conditions.push(inArray(genres.name, filters.genres));
				}
			}

			if (conditions.length > 0) {
				countQuery = countQuery.where(and(...conditions)) as any;
			}

			const result = await countQuery;
			return result[0]?.count || 0;
		} catch (error) {
			console.error('Error counting movies with filters:', error);
			return 0;
		}
	},

	/**
	 * Build ORDER BY clause based on sort options
	 */
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
