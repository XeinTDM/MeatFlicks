import sqlite from "$lib/server/db";
import type { CollectionRecord, GenreRecord, MovieRow, MovieSummary } from "$lib/server/db";
import {
	MOVIE_COLUMNS,
	MOVIE_ORDER_BY,
	mapRowsToSummaries
} from "$lib/server/db/movie-select";
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
				const statement = sqlite.prepare(
					`SELECT ${MOVIE_COLUMNS}
					FROM movies m
					WHERE m.rating IS NOT NULL
					${MOVIE_ORDER_BY}
					LIMIT ?`
				);
				const rows = statement.all(take) as MovieRow[];
				return mapRowsToSummaries(rows);
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
				const statement = sqlite.prepare(
					`SELECT id, name, slug, description
					FROM collections
					ORDER BY name COLLATE NOCASE ASC`
				);
				return statement.all() as CollectionRecord[];
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
					const collectionStmt = sqlite.prepare(
						`SELECT id, name, slug, description FROM collections WHERE slug = ?`
					);
					const collection = collectionStmt.get(collectionSlug) as CollectionRecord | undefined;
					if (!collection) {
						return null;
					}

					const limitValue = take ?? -1;
					const moviesStmt = sqlite.prepare(
						`SELECT ${MOVIE_COLUMNS}
						FROM movies m
						WHERE m.collectionId = ?
						${MOVIE_ORDER_BY}
						LIMIT ? OFFSET ?`
					);

					const rows = moviesStmt.all(collection.id, limitValue, skip) as MovieRow[];
					return { ...collection, movies: mapRowsToSummaries(rows) };
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
				const collectionStmt = sqlite.prepare("SELECT id FROM collections WHERE slug = ?");
				const collection = collectionStmt.get(collectionSlug) as { id: number } | undefined;
				if (!collection) {
					return [];
				}

				const moviesStmt = sqlite.prepare(
					`SELECT ${MOVIE_COLUMNS}
					FROM movies m
					WHERE m.collectionId = ?
					${MOVIE_ORDER_BY}
					LIMIT ? OFFSET ?`
				);

				const rows = moviesStmt.all(collection.id, take, skip) as MovieRow[];
				return mapRowsToSummaries(rows);
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
				const statement = sqlite.prepare(
					"SELECT id, name FROM genres ORDER BY name COLLATE NOCASE ASC"
				);
				return statement.all() as GenreRecord[];
			});
		} catch (error) {
			console.error("Error fetching genres:", error);
			throw new Error("Failed to fetch genres");
		}
	},

	async findGenreByName(genreName: string): Promise<GenreRecord | null> {
		try {
			const statement = sqlite.prepare(
				"SELECT id, name FROM genres WHERE name = ?"
			);
			return (statement.get(genreName) as GenreRecord | undefined) ?? null;
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
				const statement = sqlite.prepare(
					`SELECT ${MOVIE_COLUMNS}
					FROM movies m
					JOIN movies_genres mg ON mg.movieId = m.id
					JOIN genres g ON g.id = mg.genreId
					WHERE g.name = ?
					${MOVIE_ORDER_BY}
					LIMIT ? OFFSET ?`
				);

				const rows = statement.all(normalizedGenre, take, skip) as MovieRow[];
				return mapRowsToSummaries(rows);
			});
		} catch (error) {
			console.error("Error fetching movies for genre " + genreName + ":", error);
			throw new Error("Failed to fetch movies for genre " + genreName);
		}
	}
};

export type LibraryRepository = typeof libraryRepository;
