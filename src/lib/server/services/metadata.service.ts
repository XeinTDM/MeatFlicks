import { db } from '$lib/server/db';
import { movies, genres, collections, moviesGenres, people, moviePeople } from '$lib/server/db/schema';
import { sql, eq, and, isNotNull, ne, desc, asc, inArray, getTableColumns } from 'drizzle-orm';
import { mapRowsToSummaries } from '$lib/server/db/movie-select';
import { logger } from '$lib/server/logger';
import { withCache, buildCacheKey, CACHE_TTL_LONG_SECONDS, CACHE_TTL_MEDIUM_SECONDS } from '$lib/server/cache';
import type { GenreRecord, MovieRow } from '$lib/server/db';
import type { LibraryMovie } from '$lib/types/library';

interface MetadataEnhancementOptions {
	includeTrailers?: boolean;
	includeCast?: boolean;
	includeGenres?: boolean;
	includeCollections?: boolean;
	limit?: number;
	offset?: number;
}

interface EnhancedMetadataResult {
	movies: LibraryMovie[];
	total: number;
	genres: GenreRecord[];
	collections: {
		id: number;
		name: string;
		slug: string;
		count: number;
	}[];
}

interface CastMember {
	id: number;
	name: string;
	character: string;
	profilePath: string | null;
}

interface CountResult {
	count: number;
}

interface GenreFacetResult {
	id: number;
	name: string;
}

interface CollectionFacetResult {
	id: number;
	name: string;
	slug: string;
	count: number;
}

export async function enhanceMovieMetadata(
	movieId: string,
	options: { includeCast?: boolean; includeTrailers?: boolean } = {}
): Promise<LibraryMovie> {
	const { includeCast = true, includeTrailers = true } = options;

	try {
		const movieRows = await db
			.select()
			.from(movies)
			.where(eq(movies.id, movieId))
			.limit(1);

		if (movieRows.length === 0) {
			throw new Error(`Movie not found: ${movieId}`);
		}

		const baseMovie = (await mapRowsToSummaries(movieRows as MovieRow[]))[0];

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
			const cast = await getMovieCast(movieId);
			enhancedMovie.cast = cast;
		}

		return enhancedMovie;
	} catch (error) {
		logger.error({ error, movieId }, 'Failed to enhance movie metadata');
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
		offset = 0
	} = options;

	const cacheKey = buildCacheKey('metadata', 'enhanced-movies', limit, offset, includeCast, includeTrailers, includeGenres, includeCollections);

	return withCache(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
		try {
			const [movieRows, total] = await Promise.all([
				db.select().from(movies)
					.orderBy(sql`(rating IS NULL) ASC`, desc(movies.rating), desc(movies.popularity))
					.limit(limit)
					.offset(offset),
				db.select({ count: sql<number>`count(*)` }).from(movies)
			]);

			const moviesResult = await mapRowsToSummaries(movieRows as MovieRow[]);
			const totalCount = (total[0] as any)?.count || 0;

			const movieIds = moviesResult.map((m) => m.id);
			let castMap = new Map<string, CastMember[]>();

			if (includeCast && movieIds.length > 0) {
				const castRows = await db.all(sql`
					SELECT
						mp.movieId, p.id, p.name, mp.character, p.profilePath
					FROM movie_people mp
					JOIN people p ON mp.personId = p.id
					WHERE mp.movieId IN (${sql.join(movieIds.map(id => sql`${id}`), sql`, `)}) AND mp.role = 'actor'
					ORDER BY mp.order ASC
				`);

				for (const row of castRows as any) {
					const list = castMap.get(row.movieId) || [];
					if (list.length < 10) {
						list.push({
							id: row.id,
							name: row.name,
							character: row.character,
							profilePath: row.profilePath
						});
						castMap.set(row.movieId, list);
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

async function getMovieCast(movieId: string): Promise<CastMember[]> {
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
			.where(and(eq(moviePeople.movieId, movieId), eq(moviePeople.role, 'actor')))
			.orderBy(asc(moviePeople.order))
			.limit(10);

		return results.map((row) => ({
			id: row.id,
			name: row.name,
			character: row.character ?? '',
			profilePath: row.profilePath
		}));
	} catch (error) {
		logger.error({ error, movieId }, 'Failed to get movie cast');
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

async function getCollectionFacets(): Promise<
	Array<{ id: number; name: string; slug: string; count: number }>
> {
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
	const { mediaType, hasTrailer, hasImdbId, genres: genreIds = [], collections: collectionIds = [] } = filters;
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
				conditions.push(sql`m.id IN (
					SELECT movieId FROM movies_genres WHERE genreId IN (${sql.join(genreIds.map(id => sql`${id}`), sql`, `)})
				)`);
			}
			if (collectionIds.length > 0) {
				conditions.push(inArray(movies.collectionId, collectionIds));
			}

			const where = conditions.length > 0 ? and(...conditions) : undefined;

			let orderBy;
			const orderFn = sortOrder === 'desc' ? desc : asc;

			switch (sortBy) {
				case 'title':
					orderBy = [orderFn(movies.title)];
					break;
				case 'releaseDate':
					orderBy = [sql`(releaseDate IS NULL) ASC`, orderFn(movies.releaseDate)];
					break;
				case 'rating':
				default:
					orderBy = [sql`(rating IS NULL) ASC`, orderFn(movies.rating)];
			}

			const [movieRows, total] = await Promise.all([
				db.select().from(movies)
					.where(where)
					.orderBy(...orderBy as any)
					.limit(limit)
					.offset(offset),
				db.select({ count: sql<number>`count(*)` }).from(movies).where(where)
			]);

			const moviesResult = await mapRowsToSummaries(movieRows as any[]);
			const totalCount = (total[0] as any)?.count || 0;

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
	metadata: {
		trailerUrl?: string;
		imdbId?: string;
		canonicalPath?: string;
		addedAt?: number;
		mediaType?: string;
	}
): Promise<void> {
	try {
		const updateData: any = {};
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
			const [stats] = await db
				.select({
					movieCount: sql<number>`COUNT(*)`,
					moviesWithTrailers: sql<number>`SUM(CASE WHEN trailerUrl IS NOT NULL AND trailerUrl != '' THEN 1 ELSE 0 END)`,
					moviesWithImdbId: sql<number>`SUM(CASE WHEN imdbId IS NOT NULL AND imdbId != '' THEN 1 ELSE 0 END)`,
					moviesWithCanonicalPath: sql<number>`SUM(CASE WHEN canonicalPath IS NOT NULL AND canonicalPath != '' THEN 1 ELSE 0 END)`
				})
				.from(movies);

			const [genreCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(genres);
			const [collectionCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(collections);

			return {
				movieCount: stats.movieCount || 0,
				genreCount: genreCount.count || 0,
				collectionCount: collectionCount.count || 0,
				moviesWithTrailers: stats.moviesWithTrailers || 0,
				moviesWithImdbId: stats.moviesWithImdbId || 0,
				moviesWithCanonicalPath: stats.moviesWithCanonicalPath || 0
			};
		} catch (error) {
			logger.error({ error }, 'Failed to get metadata statistics');
			throw error;
		}
	});
}
