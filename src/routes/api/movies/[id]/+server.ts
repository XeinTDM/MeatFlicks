import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { movies, genres, moviesGenres } from '$lib/server/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import type { GenreRecord, MovieRecord, MovieRow } from '$lib/server/db';
import { mapRowsToRecords } from '$lib/server/db/movie-select';
import {
	CACHE_TTL_LONG_SECONDS,
	buildCacheKey,
	setCachedValue,
	withCache
} from '$lib/server/cache';
import {
	fetchTmdbMovieDetails,
	fetchTmdbMovieExtras,
	lookupTmdbIdByImdbId
} from '$lib/server/services/tmdb.service';
import { randomUUID } from 'node:crypto';
import { errorHandler, NotFoundError, ValidationError, getEnv } from '$lib/server';
import { z } from 'zod';
import {
	validatePathParams,
	validateQueryParams,
	movieIdentifierSchema,
	queryModeSchema
} from '$lib/server/validation';

const clampTtl = (value: number): number => {
	const min = 300;
	const max = 1800;
	if (!Number.isFinite(value)) {
		return CACHE_TTL_LONG_SECONDS;
	}
	return Math.min(Math.max(value, min), max);
};

const MOVIE_CACHE_TTL_SECONDS = clampTtl(
	Number.parseInt(getEnv('CACHE_TTL_MOVIE', CACHE_TTL_LONG_SECONDS.toString()) ?? '', 10) ||
		CACHE_TTL_LONG_SECONDS
);

const detectQueryMode = (identifier: string): 'id' | 'tmdb' | 'imdb' => {
	if (/^tt\d{7,}$/i.test(identifier)) {
		return 'imdb';
	}
	return 'id';
};

type MovieLookup = { kind: 'id'; value: string } | { kind: 'tmdb'; value: number };

const loadMovie = async (lookup: MovieLookup): Promise<MovieRecord | null> => {
	let rows: any[] = [];
	if (lookup.kind === 'id') {
		rows = await db.select().from(movies).where(eq(movies.id, lookup.value)).limit(1);
	} else {
		rows = await db.select().from(movies).where(eq(movies.tmdbId, lookup.value)).limit(1);
	}

	if (rows.length === 0) {
		return null;
	}

	const [movie] = await mapRowsToRecords(rows as MovieRow[]);
	return movie ?? null;
};

async function cacheMovieVariants(
	movie: MovieRecord,
	skipKey?: string,
	additionalKeys: string[] = []
) {
	const keys = new Set<string>();

	if (movie.id) {
		keys.add(buildCacheKey('movie', 'id', movie.id));
	}

	if (isValidTmdbId(movie.tmdbId)) {
		keys.add(buildCacheKey('movie', 'tmdb', movie.tmdbId));
	}

	for (const key of additionalKeys) {
		if (key) {
			keys.add(key);
		}
	}

	if (skipKey) {
		keys.delete(skipKey);
	}

	if (keys.size === 0) {
		return;
	}

	await Promise.all(
		Array.from(keys).map((key) => setCachedValue(key, movie, MOVIE_CACHE_TTL_SECONDS))
	);
}

async function fetchMovieWithCache(
	cacheKey: string,
	lookup: MovieLookup,
	extraKeySelector?: (movie: MovieRecord) => string[]
): Promise<MovieRecord | null> {
	return withCache<MovieRecord | null>(cacheKey, MOVIE_CACHE_TTL_SECONDS, async () => {
		const movie = await loadMovie(lookup);

		if (movie) {
			const extraKeys = extraKeySelector ? extraKeySelector(movie) : [];
			await cacheMovieVariants(movie, cacheKey, extraKeys);
		}

		return movie;
	});
}

async function resolveMovieByIdentifier(identifier: string, queryMode: 'id' | 'tmdb' | 'imdb') {
	switch (queryMode) {
		case 'tmdb': {
			const tmdbId = Number.parseInt(identifier, 10);
			if (!Number.isFinite(tmdbId)) {
				throw new ValidationError('Invalid TMDB id provided.');
			}

			const movie = await fetchMovieWithCache(
				buildCacheKey('movie', 'tmdb', tmdbId),
				{ kind: 'tmdb', value: tmdbId },
				(record) => [buildCacheKey('movie', 'id', record.id)]
			);

			return { movie, tmdbId } as const;
		}
		case 'imdb': {
			const tmdbId = await lookupTmdbIdByImdbId(identifier);
			if (!tmdbId) {
				return { movie: null, tmdbId: null } as const;
			}

			const movie = await fetchMovieWithCache(
				buildCacheKey('movie', 'tmdb', tmdbId),
				{ kind: 'tmdb', value: tmdbId },
				(record) => [buildCacheKey('movie', 'id', record.id)]
			);

			return { movie, tmdbId } as const;
		}
		case 'id':
		default: {
			const cacheKey = buildCacheKey('movie', 'id', identifier);
			const movie = await fetchMovieWithCache(
				cacheKey,
				{ kind: 'id', value: identifier },
				(record) =>
					isValidTmdbId(record.tmdbId) ? [buildCacheKey('movie', 'tmdb', record.tmdbId)] : []
			);

			return { movie, tmdbId: movie?.tmdbId ?? null } as const;
		}
	}
}

async function upsertMovieWithGenres(payload: {
	tmdbId: number;
	title: string;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	releaseDate: string | null;
	rating: number | null;
	durationMinutes: number | null;
	is4K: boolean;
	isHD: boolean;
	genreNames: string[];
}) {
	return await db.transaction(async (tx) => {
		const genreIds: number[] = [];
		for (const rawName of payload.genreNames) {
			const name = rawName.trim();
			if (!name) continue;

			const existing = await tx.select().from(genres).where(eq(genres.name, name)).limit(1);
			if (existing.length > 0) {
				genreIds.push(existing[0].id);
				continue;
			}

			const result = await tx.insert(genres).values({ name }).returning({ id: genres.id });
			genreIds.push(result[0].id);
		}

		const existingResults = await tx
			.select()
			.from(movies)
			.where(eq(movies.tmdbId, payload.tmdbId))
			.limit(1);
		const existingRow = existingResults[0];
		const movieId = existingRow?.id ?? randomUUID();

		const movieData = {
			id: movieId,
			tmdbId: payload.tmdbId,
			title: payload.title,
			overview: payload.overview,
			posterPath: payload.posterPath,
			backdropPath: payload.backdropPath,
			releaseDate: payload.releaseDate,
			rating: payload.rating,
			durationMinutes: payload.durationMinutes,
			is4K: payload.is4K,
			isHD: payload.isHD,
			updatedAt: Date.now()
		};

		if (existingRow) {
			await tx.update(movies).set(movieData).where(eq(movies.tmdbId, payload.tmdbId));
		} else {
			await tx.insert(movies).values({ ...movieData, createdAt: Date.now() });
		}

		await tx.delete(moviesGenres).where(eq(moviesGenres.movieId, movieId));
		for (const genreId of genreIds) {
			await tx.insert(moviesGenres).values({ movieId, genreId }).onConflictDoNothing();
		}

		const refreshed = await tx.select().from(movies).where(eq(movies.id, movieId)).limit(1);
		if (refreshed.length === 0) {
			return null;
		}

		const [movie] = await mapRowsToRecords(refreshed as MovieRow[]);
		return movie ?? null;
	});
}

const isValidTmdbId = (value: unknown): value is number => {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

type MovieWithDetails = MovieRecord & {
	imdbId: string | null;
	cast: { id: number; name: string; character: string; profilePath?: string | null }[];
	trailerUrl: string | null;
};

async function resolveFallbackMovie(tmdbId: number): Promise<MovieWithDetails | null> {
	if (!isValidTmdbId(tmdbId)) {
		console.log(`[API] Invalid TMDB ID: ${tmdbId}`);
		return null;
	}

	console.log(`[API] Fetching TMDB details for ID: ${tmdbId}`);
	const details = await fetchTmdbMovieDetails(tmdbId);

	if (!details.found) {
		console.log(`[API] TMDB movie not found for ID: ${tmdbId}`);
		return null;
	}

	console.log(`[API] TMDB movie found: ${details.title} (${tmdbId})`);

	const releaseDate = details.releaseDate ? details.releaseDate.trim() : null;
	const rating = details.rating ?? null;
	const durationMinutes = details.runtime ?? null;
	const genreNames = Array.from(
		new Set(
			details.genres
				.map((genre) => (typeof genre.name === 'string' ? genre.name.trim() : ''))
				.filter(Boolean)
		)
	);

	const movie = await upsertMovieWithGenres({
		tmdbId,
		title: details.title ?? 'Untitled',
		overview: details.overview ?? null,
		posterPath: details.posterPath ?? null,
		backdropPath: details.backdropPath ?? null,
		releaseDate,
		rating,
		durationMinutes,
		is4K: false,
		isHD: true,
		genreNames
	});

	if (!movie) {
		return null;
	}

	await cacheMovieVariants(movie);

	return {
		...movie,
		imdbId: details.imdbId,
		cast: details.cast
			.filter(c => c.character && c.character.trim())
			.map(c => ({ ...c, character: c.character! })),
		trailerUrl: details.trailerUrl
	};
}

export const GET: RequestHandler = async ({ params, url }) => {
	const pathParams = validatePathParams(movieIdentifierSchema, { id: params.id ?? '' });
	const queryParams = validateQueryParams(
		z.object({ by: queryModeSchema.optional() }),
		url.searchParams
	);

	const movieIdentifier = pathParams.id;
	const queryMode =
		(queryParams as { by?: 'id' | 'tmdb' | 'imdb' }).by ?? detectQueryMode(movieIdentifier);

	try {
		const { movie, tmdbId } = await resolveMovieByIdentifier(movieIdentifier, queryMode);
		const effectiveTmdbId = isValidTmdbId(tmdbId)
			? tmdbId
			: queryMode === 'tmdb'
				? Number.parseInt(movieIdentifier, 10)
				: null;

		if (!movie) {
			console.log(`[API] Movie not found in DB, trying fallback for TMDB ID: ${effectiveTmdbId}`);
			const fallbackMovie = isValidTmdbId(effectiveTmdbId)
				? await resolveFallbackMovie(effectiveTmdbId)
				: null;

			if (!fallbackMovie) {
				console.log(`[API] Fallback failed for TMDB ID: ${effectiveTmdbId}`);
				throw new NotFoundError('Movie not found');
			}

			console.log(`[API] Fallback succeeded for TMDB ID: ${effectiveTmdbId}`);
			return json(fallbackMovie);
		}

		let extras = null;
		if (isValidTmdbId(effectiveTmdbId)) {
			try {
				extras = await fetchTmdbMovieExtras(effectiveTmdbId);
			} catch (error) {
				console.log(`[API] Failed to fetch TMDB extras for ${effectiveTmdbId}, using DB data only`);
			}
		}

		const payload = {
			...movie,
			releaseDate: movie.releaseDate ?? (extras?.releaseDate ? new Date(extras.releaseDate) : null),
			durationMinutes: movie.durationMinutes ?? extras?.runtime ?? null,
			imdbId: extras?.imdbId ?? movie.imdbId ?? null,
			cast: (extras?.cast ?? [])
				.filter(c => c.character && c.character.trim())
				.map(c => ({ ...c, character: c.character! })),
			trailerUrl: extras?.trailerUrl ?? movie.trailerUrl ?? null,
			productionCompanies: extras?.productionCompanies ?? [],
			productionCountries: extras?.productionCountries ?? [],
			voteCount: extras?.voteCount ?? null
		};

		return json(payload);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
