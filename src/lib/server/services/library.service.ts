import { withCache, CACHE_TTL_MEDIUM_SECONDS } from '$lib/server/cache';
import { toSlug } from '$lib/utils';
import { updateLastRefreshTime } from '$lib/server/utils';
import { logger } from '$lib/server/logger';
import { libraryRepository } from '$lib/server/repositories/library.repository';
import { ensureHomeLibraryPrimed } from '$lib/server/services/home-library-optimizer';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import type { MovieSummary } from '$lib/server/db';
import type {
	HomeLibrary,
	LibraryCollection,
	LibraryGenre,
	LibraryMovie
} from '$lib/types/library';
import {
	fetchTmdbMovieDetails,
	fetchTmdbMovieExtras,
	fetchTrendingMovieIds,
	type TmdbMovieDetails,
	type TmdbMovieGenre
} from '$lib/server/services/tmdb.service';

const HOME_LIBRARY_CACHE_KEY = 'home-library';
const HOME_LIBRARY_MOVIES_LIMIT = 10;
const HOME_LIBRARY_COLLECTIONS_LIMIT = 10;
const HOME_LIBRARY_GENRES_LIMIT = 10;

const toLibraryMovie = (movie: MovieSummary): LibraryMovie => ({
	...movie,
	releaseDate: movie.releaseDate ?? null,
	durationMinutes: movie.durationMinutes ?? null,
	genres: movie.genres ?? []
});

const buildFallbackHomeLibrary = async (limit: number): Promise<HomeLibrary | null> => {
	try {
		logger.info('[library][fallback] Starting fallback library build');
		const ids = await fetchTrendingMovieIds(limit);
		const detailsList = await Promise.all(
			ids.map(async (id) => {
				try {
					const details = await tmdbRateLimiter.schedule('tmdb-bulk-fallback', () =>
						fetchTmdbMovieDetails(id)
					);
					return details.found ? details : null;
				} catch (error) {
					logger.warn({ id, error }, '[library][fallback] failed to fetch TMDB details');
					return null;
				}
			})
		);

		const { upsertMovieWithGenres } = await import('$lib/server/db/mutations');
		const { db } = await import('$lib/server/db/client');
		const { movies } = await import('$lib/server/db/schema');
		const { eq } = await import('drizzle-orm');
		const storedMovies: MovieSummary[] = [];

		for (const details of detailsList.filter((d): d is TmdbMovieDetails => Boolean(d?.found))) {
			try {
				const genreNames = Array.from(
					new Set(details.genres.map((genre) => genre.name).filter(Boolean))
				);

				logger.info(
					{ tmdbId: details.tmdbId, title: details.title },
					'[library][fallback] Storing movie'
				);

				const storedMovie = await upsertMovieWithGenres({
					tmdbId: details.tmdbId,
					title: details.title ?? 'Untitled',
					overview: details.overview ?? null,
					posterPath: details.posterPath ?? null,
					backdropPath: details.backdropPath ?? null,
					releaseDate: details.releaseDate ?? null,
					rating: details.rating ?? null,
					durationMinutes: details.runtime ?? null,
					is4K: false,
					isHD: true,
					genreNames,
					imdbId: details.imdbId ?? null,
					trailerUrl: details.trailerUrl ?? null
				});

				if (storedMovie) {
					logger.info(
						{ movieId: storedMovie.id, imdbId: details.imdbId },
						'[library][fallback] Movie stored, updating IMDB ID'
					);

					await db
						.update(movies)
						.set({
							imdbId: details.imdbId,
							trailerUrl: details.trailerUrl,
							updatedAt: Date.now()
						})
						.where(eq(movies.id, storedMovie.id));

					storedMovies.push(storedMovie);
				} else {
					logger.warn({ tmdbId: details.tmdbId }, '[library][fallback] Failed to store movie');
				}
			} catch (error) {
				logger.warn({ tmdbId: details.tmdbId, error }, '[library][fallback] failed to store movie');
			}
		}

		if (storedMovies.length === 0) {
			return null;
		}

		const fallbackMovies = storedMovies.map((movie) => {
			const libraryMovie = toLibraryMovie(movie);
			const canonicalPath = movie.tmdbId
				? `/movie/${movie.tmdbId}`
				: movie.imdbId
					? `/movie/${movie.imdbId}`
					: `/movie/${movie.id}`;
			return {
				...libraryMovie,
				canonicalPath
			};
		});

		return {
			trendingMovies: fallbackMovies,
			trendingTv: [],
			collections: [],
			genres: []
		};
	} catch (error) {
		logger.error({ error }, '[library][fallback] failed to build fallback library');
		return null;
	}
};

const buildExtrasMap = async (
	movies: { tmdbId?: number | null | undefined }[]
): Promise<Map<number, { imdbId: string | null; trailerUrl: string | null }>> => {
	const uniqueIds = Array.from(
		movies
			.map((movie) => movie.tmdbId)
			.filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0)
			.reduce<Set<number>>((accumulator, tmdbId) => accumulator.add(tmdbId), new Set<number>())
	);

	const extrasMap = new Map<number, { imdbId: string | null; trailerUrl: string | null }>();

	await Promise.all(
		uniqueIds.map(async (tmdbId) => {
			try {
				const extras = await tmdbRateLimiter.schedule('tmdb-home-extras', () =>
					fetchTmdbMovieExtras(tmdbId)
				);
				extrasMap.set(tmdbId, {
					imdbId: extras.imdbId ?? null,
					trailerUrl: extras.trailerUrl ?? null
				});
			} catch (error) {
				logger.error({ tmdbId, error }, '[library][tmdb] Failed to fetch metadata');
				extrasMap.set(tmdbId, { imdbId: null, trailerUrl: null });
			}
		})
	);

	return extrasMap;
};

const attachIdentifiers = (
	movie: LibraryMovie,
	extrasMap: Map<number, { imdbId: string | null; trailerUrl: string | null }>
): LibraryMovie => {
	const extras = movie.tmdbId ? (extrasMap.get(movie.tmdbId) ?? null) : null;
	const imdbId = extras?.imdbId ?? null;
	const trailerUrl = extras?.trailerUrl ?? movie.trailerUrl ?? null;
	const canonicalPath = movie.tmdbId ? '/movie/' + movie.tmdbId : '/movie/' + (imdbId ?? movie.id);

	return {
		...movie,
		imdbId,
		trailerUrl,
		canonicalPath
	} satisfies LibraryMovie;
};

async function fetchHomeLibraryFromSource(): Promise<HomeLibrary> {
	const [trendingRaw, trendingTvRaw, collectionsRaw, genresRaw] = await Promise.all([
		libraryRepository.findTrendingMovies(HOME_LIBRARY_MOVIES_LIMIT, 'movie'),
		libraryRepository.findTrendingMovies(HOME_LIBRARY_MOVIES_LIMIT, 'tv'),
		libraryRepository.listCollections(),
		libraryRepository.listGenres()
	]);

	const collections = collectionsRaw.slice(0, HOME_LIBRARY_COLLECTIONS_LIMIT);
	const genres = genresRaw.slice(0, HOME_LIBRARY_GENRES_LIMIT);

	const trendingMovies = trendingRaw.map(toLibraryMovie);
	const trendingTv = trendingTvRaw.map(toLibraryMovie);

	const collectionsWithMovies = await Promise.all(
		collections.map(async (collection) => {
			const movies = await libraryRepository
				.findCollectionMovies(collection.slug, HOME_LIBRARY_MOVIES_LIMIT)
				.then((items) => items.map(toLibraryMovie));
			return {
				...collection,
				movies
			} satisfies LibraryCollection;
		})
	);

	const genresWithMovies = await Promise.all(
		genres.map(async (genre) => {
			const movies = await libraryRepository
				.findGenreMovies(genre.name, HOME_LIBRARY_MOVIES_LIMIT)
				.then((items) => items.map(toLibraryMovie));
			return {
				...genre,
				slug: toSlug(genre.name),
				movies
			} satisfies LibraryGenre;
		})
	);

	const extrasMap = await buildExtrasMap([
		...trendingMovies,
		...trendingTv,
		...collectionsWithMovies.flatMap((collection) => collection.movies),
		...genresWithMovies.flatMap((genre) => genre.movies)
	]);

	const decorate = (movie: LibraryMovie) => attachIdentifiers(movie, extrasMap);

	const decoratedTrending = trendingMovies.map(decorate);
	const decoratedTrendingTv = trendingTv.map(decorate);
	const decoratedCollections = collectionsWithMovies.map((collection) => ({
		...collection,
		movies: collection.movies.map(decorate)
	}));
	const decoratedGenres = genresWithMovies.map((genre) => ({
		...genre,
		movies: genre.movies.map(decorate)
	}));

	return {
		trendingMovies: decoratedTrending,
		trendingTv: decoratedTrendingTv,
		collections: decoratedCollections,
		genres: decoratedGenres
	} satisfies HomeLibrary;
}

export interface FetchHomeLibraryOptions {
	forceRefresh?: boolean;
}

export async function fetchHomeLibrary(
	options: FetchHomeLibraryOptions = {}
): Promise<HomeLibrary> {
	const { forceRefresh = false } = options;

	if (forceRefresh) {
		const { deleteCachedValue } = await import('$lib/server/cache');
		await deleteCachedValue(HOME_LIBRARY_CACHE_KEY);
	}

	try {
		await ensureHomeLibraryPrimed({ force: forceRefresh });
	} catch (error) {
		logger.error({ error }, '[library] Failed to prime home library data');
	}

	let result: HomeLibrary;
	try {
		result = await withCache(
			HOME_LIBRARY_CACHE_KEY,
			CACHE_TTL_MEDIUM_SECONDS,
			fetchHomeLibraryFromSource
		);
	} catch (error) {
		logger.error({ error }, '[library] Failed to fetch home library from source');
		try {
			result = await withCache(HOME_LIBRARY_CACHE_KEY, CACHE_TTL_MEDIUM_SECONDS, async () => {
				const fallback = await buildFallbackHomeLibrary(HOME_LIBRARY_MOVIES_LIMIT);
				return fallback ?? { trendingMovies: [], trendingTv: [], collections: [], genres: [] };
			});
		} catch (fallbackError) {
			logger.error({ error: fallbackError }, '[library] Failed to build fallback library');
			result = { trendingMovies: [], trendingTv: [], collections: [], genres: [] };
		}
	}

	if (forceRefresh) {
		try {
			await updateLastRefreshTime();
		} catch (error) {
			logger.error({ error }, '[library] Failed to update refresh timestamp');
		}
	}

	return structuredClone(result);
}

export async function invalidateHomeLibraryCache() {
	const { deleteCachedValue } = await import('$lib/server/cache');
	await deleteCachedValue(HOME_LIBRARY_CACHE_KEY);
}

export const libraryService = {
	fetchHomeLibrary,
	invalidateHomeLibraryCache
};
