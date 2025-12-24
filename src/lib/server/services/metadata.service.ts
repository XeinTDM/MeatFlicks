import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { mapRowsToSummaries } from '$lib/server/db/movie-select';
import { logger } from '$lib/server/logger';
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
		const movieRows = await db.all(sql<MovieRow>`
			SELECT * FROM movies WHERE id = ${movieId} LIMIT 1
		`);

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

	try {
		const [movieRows, total] = await Promise.all([
			db.all(sql`
				SELECT * FROM movies
				ORDER BY (rating IS NULL) ASC, rating DESC, popularity DESC
				LIMIT ${limit} OFFSET ${offset}
			`),
			db.all(sql`SELECT COUNT(*) as count FROM movies`)
		]);

		const movies = await mapRowsToSummaries(movieRows as unknown as MovieRow[]);
		const totalCount = (total[0] as CountResult)?.count || 0;

		const enhancedMovies = await Promise.all(
			movies.map(async (movie) => {
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
					enhancedMovie.cast = await getMovieCast(movie.id);
				}

				return enhancedMovie;
			})
		);

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
}

async function getMovieCast(movieId: string): Promise<CastMember[]> {
	try {
		const castRows = await db.all(sql`
			SELECT
				p.id, p.name, mp.character, p.profilePath
			FROM movie_people mp
			JOIN people p ON mp.personId = p.id
			WHERE mp.movieId = ${movieId} AND mp.role = 'actor'
			ORDER BY mp.order ASC
			LIMIT 10
		`);

		return castRows.map((row: unknown) => ({
			id: (row as { id: number }).id,
			name: (row as { name: string }).name,
			character: (row as { character: string }).character,
			profilePath: (row as { profilePath: string | null }).profilePath
		}));
	} catch (error) {
		logger.error({ error, movieId }, 'Failed to get movie cast');
		return [];
	}
}

async function getGenreFacets(): Promise<GenreRecord[]> {
	try {
		const results = await db.all(sql`
			SELECT g.id, g.name, COUNT(*) as count
			FROM genres g
			JOIN movies_genres mg ON g.id = mg.genreId
			GROUP BY g.id, g.name
			ORDER BY count DESC, g.name ASC
		`);

		return results.map((row: unknown) => ({
			id: (row as GenreFacetResult).id,
			name: (row as GenreFacetResult).name
		}));
	} catch (error) {
		logger.error({ error }, 'Failed to get genre facets');
		return [];
	}
}

async function getCollectionFacets(): Promise<
	Array<{ id: number; name: string; slug: string; count: number }>
> {
	try {
		const results = await db.all(sql`
			SELECT c.id, c.name, c.slug, COUNT(*) as count
			FROM collections c
			LEFT JOIN movies m ON c.id = m.collectionId
			GROUP BY c.id, c.name, c.slug
			ORDER BY count DESC, c.name ASC
		`);

		return results.map((row: any) => ({
			id: row.id,
			name: row.name,
			slug: row.slug,
			count: row.count
		}));
	} catch (error) {
		logger.error({ error }, 'Failed to get collection facets');
		return [];
	}
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
	const { mediaType, hasTrailer, hasImdbId, genres = [], collections = [] } = filters;

	const { limit = 20, offset = 0, sortBy = 'rating', sortOrder = 'desc' } = options;

	try {
		const whereClauses = [];
		const params = [];

		if (mediaType) {
			whereClauses.push('m.mediaType = ?');
			params.push(mediaType);
		}

		if (hasTrailer) {
			whereClauses.push('m.trailerUrl IS NOT NULL AND m.trailerUrl != ""');
		}

		if (hasImdbId) {
			whereClauses.push('m.imdbId IS NOT NULL AND m.imdbId != ""');
		}

		if (genres.length > 0) {
			whereClauses.push(`m.id IN (
				SELECT movieId FROM movies_genres WHERE genreId IN (${genres.join(',')})
			)`);
		}

		if (collections.length > 0) {
			whereClauses.push(`m.collectionId IN (${collections.join(',')})`);
		}

		const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

		let orderByClause = '';
		switch (sortBy) {
			case 'title':
				orderByClause = 'ORDER BY m.title COLLATE NOCASE';
				break;
			case 'releaseDate':
				orderByClause = 'ORDER BY (m.releaseDate IS NULL) ASC, m.releaseDate';
				break;
			case 'rating':
			default:
				orderByClause = 'ORDER BY (m.rating IS NULL) ASC, m.rating';
		}
		orderByClause += ` ${sortOrder}`;

		const [movieRows, total] = await Promise.all([
			db.all(sql`
				SELECT m.* FROM movies m
				${whereClause}
				${orderByClause}
				LIMIT ${limit} OFFSET ${offset}
			`),
			db.all(sql`
				SELECT COUNT(*) as count FROM movies m
				${whereClause}
			`)
		]);

		const movies = await mapRowsToSummaries(movieRows as any[]);
		const totalCount = (total[0] as any)?.count || 0;

		const enhancedMovies = movies.map((movie) => ({
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
		const updates = [];
		const params = [];

		if (metadata.trailerUrl !== undefined) {
			updates.push('trailerUrl = ?');
			params.push(metadata.trailerUrl);
		}

		if (metadata.imdbId !== undefined) {
			updates.push('imdbId = ?');
			params.push(metadata.imdbId);
		}

		if (metadata.canonicalPath !== undefined) {
			updates.push('canonicalPath = ?');
			params.push(metadata.canonicalPath);
		}

		if (metadata.addedAt !== undefined) {
			updates.push('addedAt = ?');
			params.push(metadata.addedAt);
		}

		if (metadata.mediaType !== undefined) {
			updates.push('mediaType = ?');
			params.push(metadata.mediaType);
		}

		if (updates.length === 0) {
			return;
		}

		params.push(movieId);

		await db.run(sql`
			UPDATE movies
			SET ${updates.join(', ')}
			WHERE id = ?
		`);

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
	try {
		const [movieCount, genreCount, collectionCount, trailers, imdbIds, canonicalPaths] =
			await Promise.all([
				db.all(sql`SELECT COUNT(*) as count FROM movies`),
				db.all(sql`SELECT COUNT(*) as count FROM genres`),
				db.all(sql`SELECT COUNT(*) as count FROM collections`),
				db.all(
					sql`SELECT COUNT(*) as count FROM movies WHERE trailerUrl IS NOT NULL AND trailerUrl != ''`
				),
				db.all(sql`SELECT COUNT(*) as count FROM movies WHERE imdbId IS NOT NULL AND imdbId != ''`),
				db.all(
					sql`SELECT COUNT(*) as count FROM movies WHERE canonicalPath IS NOT NULL AND canonicalPath != ''`
				)
			]);

		return {
			movieCount: (movieCount[0] as any)?.count || 0,
			genreCount: (genreCount[0] as any)?.count || 0,
			collectionCount: (collectionCount[0] as any)?.count || 0,
			moviesWithTrailers: (trailers[0] as any)?.count || 0,
			moviesWithImdbId: (imdbIds[0] as any)?.count || 0,
			moviesWithCanonicalPath: (canonicalPaths[0] as any)?.count || 0
		};
	} catch (error) {
		logger.error({ error }, 'Failed to get metadata statistics');
		throw error;
	}
}
