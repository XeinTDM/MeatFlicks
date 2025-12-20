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
const HOME_LIBRARY_MOVIES_LIMIT = 20;

const toLibraryMovie = (movie: MovieSummary): LibraryMovie => ({
	...movie,
	releaseDate: movie.releaseDate ?? null,
	durationMinutes: movie.durationMinutes ?? null,
	genres: movie.genres ?? []
});

const tmdbDetailsToLibraryMovie = (details: TmdbMovieDetails): LibraryMovie => ({
	id: details.tmdbId
		? String(details.tmdbId)
		: `tmdb-fallback-${Math.random().toString(36).slice(2)}`,
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
	collectionId: null,
	genres: details.genres.map((genre: TmdbMovieGenre) => ({ id: genre.id, name: genre.name })),
	cast: details.cast,
	trailerUrl: details.trailerUrl ?? null,
	imdbId: details.imdbId ?? null,
	canonicalPath: details.imdbId
		? `/movie/${details.imdbId}`
		: details.tmdbId
			? `/movie/${details.tmdbId}`
			: undefined
});

const buildFallbackHomeLibrary = async (limit: number): Promise<HomeLibrary | null> => {
	try {
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

		const fallbackMovies = detailsList
			.filter((details): details is TmdbMovieDetails => Boolean(details?.found))
			.map((details) => tmdbDetailsToLibraryMovie(details));

		if (fallbackMovies.length === 0) {
			return null;
		}

		return {
			trendingMovies: fallbackMovies,
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
	const canonicalPath = imdbId ? '/movie/' + imdbId : '/movie/' + (movie.tmdbId ?? movie.id);

	return {
		...movie,
		imdbId,
		trailerUrl,
		canonicalPath
	} satisfies LibraryMovie;
};

async function fetchHomeLibraryFromSource(): Promise<HomeLibrary> {
	const [trendingRaw, collections, genres] = await Promise.all([
		libraryRepository.findTrendingMovies(HOME_LIBRARY_MOVIES_LIMIT),
		libraryRepository.listCollections(),
		libraryRepository.listGenres()
	]);

	const trendingMovies = trendingRaw.map(toLibraryMovie);

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
		...collectionsWithMovies.flatMap((collection) => collection.movies),
		...genresWithMovies.flatMap((genre) => genre.movies)
	]);

	const decorate = (movie: LibraryMovie) => attachIdentifiers(movie, extrasMap);

	const decoratedTrending = trendingMovies.map(decorate);
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

	const result = await withCache(
		HOME_LIBRARY_CACHE_KEY,
		CACHE_TTL_MEDIUM_SECONDS,
		fetchHomeLibraryFromSource
	);

	if (forceRefresh) {
		await updateLastRefreshTime();
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
