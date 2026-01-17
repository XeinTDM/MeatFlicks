import { db } from '../db';
import { movies, genres, collections, moviesGenres, people, moviePeople } from '../db/schema';
import { sql, eq, and, isNotNull, ne, desc, asc, inArray } from 'drizzle-orm';
import { mapRowsToSummaries } from '../db/movie-select';
import { logger } from '../logger';
import {
	withCache,
	buildCacheKey,
	CACHE_TTL_LONG_SECONDS,
	CACHE_TTL_MEDIUM_SECONDS
} from '../cache';
import type { GenreRecord, MovieRow } from '../db/types';
import type { LibraryMovie } from '../../types/library';

interface MetadataEnhancementOptions {
	includeTrailers?: boolean;
	includeCast?: boolean;
	includeGenres?: boolean;
	includeCollections?: boolean;
	limit?: number;
	offset?: number;
	sortBy?: 'title' | 'releaseDate' | 'rating';
	sortOrder?: 'asc' | 'desc';
}

interface EnhancedMetadataResult {
	movies: LibraryMovie[];
	total: number;
	genres: GenreRecord[];
	collections: CollectionFacetResult[];
}

interface CastMember {
	id: string;
	name: string;
	character: string;
	profilePath: string | null;
}

interface CountResult {
	count: number;
}

interface CollectionFacetResult {
	id: number;
	name: string;
	slug: string;
	count: number;
}

type MovieMetadataUpdate = {
	trailerUrl?: string | null;
	imdbId?: string | null;
	canonicalPath?: string | null;
	addedAt?: number;
	mediaType?: string;
};

export async function enhanceMovieMetadata(
	mediaId: string,
	options: { includeCast?: boolean; includeTrailers?: boolean } = {}
): Promise<LibraryMovie> {
	const { includeCast = true, includeTrailers = true } = options;

	try {
		const movieRow = await db.select().from(movies).where(eq(movies.id, mediaId)).get();

		if (!movieRow) {
			throw new Error(`Movie not found: ${mediaId}`);
		}

		const baseMovie = (await mapRowsToSummaries([movieRow as MovieRow]))[0];

		const enhancedMovie: LibraryMovie = {
			...baseMovie,
			trailerUrl: includeTrailers ? baseMovie.trailerUrl : null,
			imdbId: baseMovie.imdbId,
			canonicalPath: baseMovie.canonicalPath,
			addedAt: baseMovie.addedAt,
			mediaType: baseMovie.mediaType,
			genres: baseMovie.genres || []
		};

		if (includeCast) {
			const cast = await getMovieCast(mediaId);
			enhancedMovie.cast = cast;
		}

		return enhancedMovie;
	} catch (error) {
		logger.error({ error, mediaId }, 'Failed to enhance movie metadata');
		throw error;
	}
}

export async function getEnhancedMovies(
	options: MetadataEnhancementOptions = {}
): Promise<EnhancedMetadataResult> {
	const {
	includeTrailers = true,
	includeCast = false,
	includeGenres = true,
	includeCollections = true,
	limit = 20,
	offset = 0,
	sortBy = 'rating',
	sortOrder = 'desc'
} = options;

	const cacheKey = buildCacheKey(
		'metadata',
		'enhanced-movies',
		limit,
		offset,
		includeCast,
		includeTrailers,
		includeGenres,
		includeCollections
	);

	return withCache(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
		try {
			const orderFn = sortOrder === 'desc' ? desc : asc;
			const movieQuery = (() => {
				const base = db.select().from(movies);

				switch (sortBy) {
					case 'title':
						return base.orderBy(orderFn(movies.title));
					case 'releaseDate':
						return base.orderBy(sql`(releaseDate IS NULL) ASC`, orderFn(movies.releaseDate));
					case 'rating':
					default:
						return base.orderBy(
							sql`(rating IS NULL) ASC`,
							orderFn(movies.rating),
							desc(movies.popularity)
						);
				}
			})();

			const [movieRows, totalCountResult] = (await db.batch([
				movieQuery.limit(limit).offset(offset),
				db.select({ count: sql<number>`count(*)` }).from(movies)
			])) as [MovieRow[], CountResult[]];

			const moviesResult = await mapRowsToSummaries(movieRows);
			const totalCount = totalCountResult[0]?.count || 0;
			const movieIds = moviesResult.map((m) => m.id);
			const castMap = new Map<string, CastMember[]>();

			if (includeCast && movieIds.length > 0) {
				const castRows = await db
					.select({
						mediaId: moviePeople.mediaId,
						id: people.id,
						name: people.name,
						character: moviePeople.character,
						profilePath: people.profilePath
					})
					.from(moviePeople)
					.innerJoin(people, eq(moviePeople.personId, people.id))
					.where(and(inArray(moviePeople.mediaId, movieIds), eq(moviePeople.role, 'actor')))
					.orderBy(asc(moviePeople.order));

				for (const row of castRows) {
					const list = castMap.get(row.mediaId) || [];
					if (list.length < 10) {
						list.push({
							id: row.id,
							name: row.name,
							character: row.character ?? '',
							profilePath: row.profilePath
						});
						castMap.set(row.mediaId, list);
					}
				}
			}

			const enhancedMovies = moviesResult.map((movie) => {
				const enhancedMovie: LibraryMovie = {
					...movie,
					trailerUrl: includeTrailers ? movie.trailerUrl : null,
					imdbId: movie.imdbId,
					canonicalPath: movie.canonicalPath,
					addedAt: movie.addedAt,
					mediaType: movie.mediaType,
					genres: movie.genres || []
				};

				if (includeCast) {
					enhancedMovie.cast = castMap.get(movie.id) || [];
				}

				return enhancedMovie;
			});

			const [genreFacets, collectionFacets] = await Promise.all([
				includeGenres ? getGenreFacets() : Promise.resolve([]),
				includeCollections ? getCollectionFacets() : Promise.resolve([])
			]);

			return {
				movies: enhancedMovies,
				total: totalCount,
				genres: genreFacets,
				collections: collectionFacets
			};
		} catch (error) {
			logger.error({ error, options }, 'Failed to get enhanced movies');
			throw error;
		}
	});
}

async function getMovieCast(mediaId: string): Promise<CastMember[]> {
	try {
		const results = await db
			.select({
				id: people.id,
				name: people.name,
				character: moviePeople.character,
				profilePath: people.profilePath
			})
			.from(moviePeople)
			.innerJoin(people, eq(moviePeople.personId, people.id))
			.where(and(eq(moviePeople.mediaId, mediaId), eq(moviePeople.role, 'actor')))
			.orderBy(asc(moviePeople.order))
			.limit(10);

		return results.map((row) => ({
			id: row.id,
			name: row.name,
			character: row.character ?? '',
			profilePath: row.profilePath
		}));
	} catch (error) {
		logger.error({ error, mediaId }, 'Failed to get movie cast');
		return [];
	}
}

async function getGenreFacets(): Promise<GenreRecord[]> {
	const cacheKey = buildCacheKey('metadata', 'facets', 'genres');
	return withCache(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
		try {
			const results = await db
				.select({
					id: genres.id,
					name: genres.name,
					count: sql<number>`count(*)`
				})
				.from(genres)
				.innerJoin(moviesGenres, eq(genres.id, moviesGenres.genreId))
				.groupBy(genres.id, genres.name)
				.orderBy(desc(sql`count(*)`), asc(genres.name));

			return results.map((row) => ({
				id: row.id,
				name: row.name
			}));
		} catch (error) {
			logger.error({ error }, 'Failed to get genre facets');
			return [];
		}
	});
}

async function getCollectionFacets(): Promise<CollectionFacetResult[]> {
	const cacheKey = buildCacheKey('metadata', 'facets', 'collections');
	return withCache(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
		try {
			const results = await db
				.select({
					id: collections.id,
					name: collections.name,
					slug: collections.slug,
					count: sql<number>`count(${movies.id})`
				})
				.from(collections)
				.leftJoin(movies, eq(collections.id, movies.collectionId))
				.groupBy(collections.id, collections.name, collections.slug)
				.orderBy(desc(sql`count(${movies.id})`), asc(collections.name));

			return results.map((row) => ({
				id: row.id,
				name: row.name,
				slug: row.slug,
				count: row.count ?? 0
			}));
		} catch (error) {
			logger.error({ error }, 'Failed to get collection facets');
			return [];
		}
	});
}

export async function getMoviesByMetadata(
	filters: {
		mediaType?: string;
		hasTrailer?: boolean;
		hasImdbId?: boolean;
		genres?: number[];
		collections?: number[];
	},
	options: { limit?: number; offset?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}
): Promise<EnhancedMetadataResult> {
	const {
		mediaType,
		hasTrailer,
		hasImdbId,
		genres: genreIds = [],
		collections: collectionIds = []
	} = filters;
	const { limit = 20, offset = 0, sortBy = 'rating', sortOrder = 'desc' } = options;

	const cacheKey = buildCacheKey(
		'metadata',
		'movies-by-metadata',
		mediaType,
		hasTrailer,
		hasImdbId,
		genreIds.join(','),
		collectionIds.join(','),
		limit,
		offset,
		sortBy,
		sortOrder
	);

	return withCache(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
		try {
			const conditions = [];
			if (mediaType) {
				conditions.push(eq(movies.mediaType, mediaType));
			}
			if (hasTrailer) {
				conditions.push(and(isNotNull(movies.trailerUrl), ne(movies.trailerUrl, '')));
			}
			if (hasImdbId) {
				conditions.push(and(isNotNull(movies.imdbId), ne(movies.imdbId, '')));
			}
			if (genreIds.length > 0) {
				conditions.push(sql`${movies.id} IN (
					SELECT mediaId FROM movies_genres WHERE genreId IN (${sql.join(
						genreIds.map((id) => sql`${id}`),
						sql`, `
					)})
				)`);
			}
			if (collectionIds.length > 0) {
				conditions.push(inArray(movies.collectionId, collectionIds));
			}

			const where = conditions.length > 0 ? and(...conditions) : undefined;

			const orderFn = sortOrder === 'desc' ? desc : asc;

			const movieQuery = (() => {
				const base = db.select().from(movies).where(where);

				switch (sortBy) {
					case 'title':
						return base.orderBy(orderFn(movies.title));
					case 'releaseDate':
						return base.orderBy(sql`(releaseDate IS NULL) ASC`, orderFn(movies.releaseDate));
					case 'rating':
					default:
						return base.orderBy(sql`(rating IS NULL) ASC`, orderFn(movies.rating));
				}
			})();

			const [movieRows, totalCountResult] = (await db.batch([
				movieQuery.limit(limit).offset(offset),
				db
					.select({ count: sql<number>`count(*)` })
					.from(movies)
					.where(where)
			])) as [MovieRow[], CountResult[]];

			const moviesResult = await mapRowsToSummaries(movieRows);
			const totalCount = totalCountResult[0]?.count || 0;

			const enhancedMovies = moviesResult.map((movie) => ({
				...movie,
				trailerUrl: movie.trailerUrl,
				imdbId: movie.imdbId,
				canonicalPath: movie.canonicalPath,
				addedAt: movie.addedAt,
				mediaType: movie.mediaType,
				genres: movie.genres || []
			}));

			const [genreFacets, collectionFacets] = await Promise.all([
				getGenreFacets(),
				getCollectionFacets()
			]);

			return {
				movies: enhancedMovies,
				total: totalCount,
				genres: genreFacets,
				collections: collectionFacets
			};
		} catch (error) {
			logger.error({ error, filters, options }, 'Failed to get movies by metadata');
			throw error;
		}
	});
}

export async function updateMovieMetadata(
	movieId: string,
	metadata: MovieMetadataUpdate
): Promise<void> {
	try {
		const updateData: MovieMetadataUpdate = {};
		if (metadata.trailerUrl !== undefined) updateData.trailerUrl = metadata.trailerUrl;
		if (metadata.imdbId !== undefined) updateData.imdbId = metadata.imdbId;
		if (metadata.canonicalPath !== undefined) updateData.canonicalPath = metadata.canonicalPath;
		if (metadata.addedAt !== undefined) updateData.addedAt = metadata.addedAt;
		if (metadata.mediaType !== undefined) updateData.mediaType = metadata.mediaType;

		if (Object.keys(updateData).length === 0) {
			return;
		}

		await db.update(movies).set(updateData).where(eq(movies.id, movieId));

		logger.info({ movieId, metadata }, 'Updated movie metadata');
	} catch (error) {
		logger.error({ error, movieId, metadata }, 'Failed to update movie metadata');
		throw error;
	}
}

export async function getMetadataStatistics(): Promise<{
	movieCount: number;
	genreCount: number;
	collectionCount: number;
	moviesWithTrailers: number;
	moviesWithImdbId: number;
	moviesWithCanonicalPath: number;
}> {
	const cacheKey = buildCacheKey('metadata', 'statistics');
	return withCache(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
		try {
			const [stats, genreCount, collectionCount] = await db.batch([
				db
					.select({
						movieCount: sql<number>`COUNT(*)`,
						moviesWithTrailers: sql<number>`SUM(CASE WHEN trailerUrl IS NOT NULL AND trailerUrl != '' THEN 1 ELSE 0 END)`,
						moviesWithImdbId: sql<number>`SUM(CASE WHEN imdbId IS NOT NULL AND imdbId != '' THEN 1 ELSE 0 END)`,
						moviesWithCanonicalPath: sql<number>`SUM(CASE WHEN canonicalPath IS NOT NULL AND canonicalPath != '' THEN 1 ELSE 0 END)`
					})
					.from(movies),
				db.select({ count: sql<number>`COUNT(*)` }).from(genres),
				db.select({ count: sql<number>`COUNT(*)` }).from(collections)
			]);

			return {
				movieCount: stats[0]?.movieCount || 0,
				genreCount: genreCount[0]?.count || 0,
				collectionCount: collectionCount[0]?.count || 0,
				moviesWithTrailers: stats[0]?.moviesWithTrailers || 0,
				moviesWithImdbId: stats[0]?.moviesWithImdbId || 0,
				moviesWithCanonicalPath: stats[0]?.moviesWithCanonicalPath || 0
			};
		} catch (error) {
			logger.error({ error }, 'Failed to get metadata statistics');
			throw error;
		}
	});
}
