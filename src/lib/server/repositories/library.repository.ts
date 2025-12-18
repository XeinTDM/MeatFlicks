import { db } from "$lib/server/db";
import { movies, collections, genres, moviesGenres } from "$lib/server/db/schema";
import { eq, and, isNotNull, desc, asc, sql } from "drizzle-orm";
import type { CollectionRecord, GenreRecord, MovieRow, MovieSummary } from "$lib/server/db";
import { mapRowsToSummaries } from "$lib/server/db/movie-select";
import {
	CACHE_TTL_LONG_SECONDS,
	CACHE_TTL_MEDIUM_SECONDS,
	CACHE_TTL_SHORT_SECONDS,
	buildCacheKey,
	withCache
} from "$lib/server/cache";

const toPositiveInteger = (value: number | undefined, fallback: number): number => {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return fallback;
	}
	return Math.floor(value);
};

const normalizeOffset = (value: number | undefined): number => {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		return 0;
	}
	return Math.floor(value);
};

export type CollectionWithMovies = CollectionRecord & { movies: MovieSummary[] };

export const libraryRepository = {
	async findTrendingMovies(limit = 20): Promise<MovieSummary[]> {
		const take = toPositiveInteger(limit, 20);

		try {
			const cacheKey = buildCacheKey("movies", "trending", take);
			return await withCache<MovieSummary[]>(cacheKey, CACHE_TTL_SHORT_SECONDS, async () => {
				const rows = await db.select().from(movies)
					.where(isNotNull(movies.rating))
					.orderBy(
						desc(movies.rating),
						desc(movies.releaseDate),
						asc(movies.title)
					)
					.limit(take);
				return await mapRowsToSummaries(rows as MovieRow[]);
			});
		} catch (error) {
			console.error("Error fetching trending movies:", error);
			throw new Error("Failed to fetch trending movies");
		}
	},

	async listCollections(): Promise<CollectionRecord[]> {
		const cacheKey = buildCacheKey("collections", "all");

		try {
			return await withCache<CollectionRecord[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				return await db.select().from(collections).orderBy(asc(collections.name));
			});
		} catch (error) {
			console.error("Error fetching collections:", error);
			throw new Error("Failed to fetch collections");
		}
	},

	async findCollectionWithMovies(
		collectionSlug: string,
		options: { limit?: number; offset?: number } = {}
	): Promise<CollectionWithMovies | null> {
		const { limit, offset } = options;
		const take = typeof limit === "number" ? toPositiveInteger(limit, 20) : undefined;
		const skip = normalizeOffset(offset);

		try {
			const cacheKey = buildCacheKey(
				"collections",
				collectionSlug,
				take ?? "all",
				skip
			);

			return await withCache<CollectionWithMovies | null>(
				cacheKey,
				CACHE_TTL_LONG_SECONDS,
				async () => {
					const collectionResults = await db.select().from(collections).where(eq(collections.slug, collectionSlug)).limit(1);
					const collection = collectionResults[0];
					if (!collection) {
						return null;
					}

					let query = db.select().from(movies)
						.where(eq(movies.collectionId, collection.id))
						.orderBy(
							desc(movies.rating),
							desc(movies.releaseDate),
							asc(movies.title)
						)
						.offset(skip);

					if (take !== undefined) {
						query = query.limit(take) as any;
					}

					const rows = await query;
					return { ...collection, movies: await mapRowsToSummaries(rows as MovieRow[]) };
				}
			);
		} catch (error) {
			console.error("Error fetching collection " + collectionSlug + ":", error);
			throw new Error("Failed to fetch collection " + collectionSlug);
		}
	},

	async findCollectionMovies(
		collectionSlug: string,
		limit?: number,
		offset?: number
	): Promise<MovieSummary[]> {
		const take = typeof limit === "number" ? toPositiveInteger(limit, 20) : 20;
		const skip = normalizeOffset(offset);

		try {
			const cacheKey = buildCacheKey("movies", "collection", collectionSlug, take, skip);
			return await withCache<MovieSummary[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				const collectionResults = await db.select({ id: collections.id }).from(collections).where(eq(collections.slug, collectionSlug)).limit(1);
				const collection = collectionResults[0];
				if (!collection) {
					return [];
				}

				const rows = await db.select().from(movies)
					.where(eq(movies.collectionId, collection.id))
					.orderBy(
						desc(movies.rating),
						desc(movies.releaseDate),
						asc(movies.title)
					)
					.limit(take)
					.offset(skip);

				return await mapRowsToSummaries(rows as MovieRow[]);
			});
		} catch (error) {
			console.error("Error fetching movies for collection " + collectionSlug + ":", error);
			throw new Error("Failed to fetch movies for collection " + collectionSlug);
		}
	},

	async listGenres(): Promise<GenreRecord[]> {
		const cacheKey = buildCacheKey("genres", "all");

		try {
			return await withCache<GenreRecord[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				return await db.select().from(genres).orderBy(asc(genres.name));
			});
		} catch (error) {
			console.error("Error fetching genres:", error);
			throw new Error("Failed to fetch genres");
		}
	},

	async findGenreByName(genreName: string): Promise<GenreRecord | null> {
		try {
			const results = await db.select().from(genres).where(eq(genres.name, genreName)).limit(1);
			return results[0] ?? null;
		} catch (error) {
			console.error("Error fetching genre " + genreName + ":", error);
			throw new Error("Failed to fetch genre " + genreName);
		}
	},

	async findGenreMovies(
		genreName: string,
		limit?: number,
		offset?: number
	): Promise<MovieSummary[]> {
		const take = typeof limit === "number" ? toPositiveInteger(limit, 20) : 20;
		const skip = normalizeOffset(offset);
		const normalizedGenre = genreName.trim();

		try {
			const cacheKey = buildCacheKey("movies", "genre", normalizedGenre.toLowerCase(), take, skip);
			return await withCache<MovieSummary[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				const rows = await db.select({ movies })
					.from(movies)
					.innerJoin(moviesGenres, eq(moviesGenres.movieId, movies.id))
					.innerJoin(genres, eq(genres.id, moviesGenres.genreId))
					.where(eq(genres.name, normalizedGenre))
					.orderBy(
						desc(movies.rating),
						desc(movies.releaseDate),
						asc(movies.title)
					)
					.limit(take)
					.offset(skip);

				// Drizzle returns { movies: MovieRow } because of the select({ movies })
				const movieRows = rows.map(r => r.movies);
				return await mapRowsToSummaries(movieRows as MovieRow[]);
			});
		} catch (error) {
			console.error("Error fetching movies for genre " + genreName + ":", error);
			throw new Error("Failed to fetch movies for genre " + genreName);
		}
	}
};

export type LibraryRepository = typeof libraryRepository;
