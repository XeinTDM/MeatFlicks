import { createTtlCache } from '$lib/server/cache';
import { clone } from '$lib/server/utils';
import { toSlug } from '$lib/utils';
import { libraryRepository } from '../repositories/library.repository';
import type {
	HomeLibrary,
	LibraryCollection,
	LibraryGenre,
	LibraryMovie
} from '$lib/types/library';
import { fetchTmdbMovieExtras } from '$lib/server/services/tmdb.service';

const HOME_LIBRARY_CACHE_KEY = 'home-library';
const HOME_LIBRARY_MOVIES_LIMIT = 20;
const homeLibraryCache = createTtlCache<string, HomeLibrary>({
	ttlMs: 1000 * 60 * 5,
	maxEntries: 1
});

const buildExtrasMap = async (
	movies: { tmdbId: number | null }[]
): Promise<Map<number, { imdbId: string | null; trailerUrl: string | null }>> => {
	const uniqueIds = Array.from(
		movies
			.map((movie) => movie.tmdbId)
			.filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0)
			.reduce<Set<number>>((accumulator, tmdbId) => accumulator.add(tmdbId), new Set<number>())
	);

	const extrasMap = new Map<number, { imdbId: string | null; trailerUrl: string | null }>();

	for (const tmdbId of uniqueIds) {
		try {
			const extras = await fetchTmdbMovieExtras(tmdbId);
			extrasMap.set(tmdbId, {
				imdbId: extras.imdbId ?? null,
				trailerUrl: extras.trailerUrl ?? null
			});
		} catch (error) {
			console.error(`[library][tmdb] Failed to fetch metadata for TMDB ${tmdbId}`, error);
			extrasMap.set(tmdbId, { imdbId: null, trailerUrl: null });
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	return extrasMap;
};

const attachIdentifiers = (
	movie: LibraryMovie,
	extrasMap: Map<number, { imdbId: string | null; trailerUrl: string | null }>
): LibraryMovie => {
	const extras = movie.tmdbId ? extrasMap.get(movie.tmdbId) ?? null : null;
	const imdbId = extras?.imdbId ?? null;
	const trailerUrl = extras?.trailerUrl ?? (movie.trailerUrl ?? null);
	const canonicalPath = imdbId ? `/movie/${imdbId}` : `/movie/${movie.tmdbId ?? movie.id}`;

	return {
		...movie,
		imdbId,
		trailerUrl,
		canonicalPath
	} satisfies LibraryMovie;
};

async function fetchHomeLibraryFromSource(): Promise<HomeLibrary> {
	const [trendingMovies, collections, genres] = await Promise.all([
		libraryRepository.findTrendingMovies(HOME_LIBRARY_MOVIES_LIMIT),
		libraryRepository.listCollections(),
		libraryRepository.listGenres()
	]);

	const collectionsWithMovies = await Promise.all(
		collections.map(async (collection) => {
			const movies = await libraryRepository.findCollectionMovies(
				collection.slug,
				HOME_LIBRARY_MOVIES_LIMIT
			);
			return {
				...collection,
				movies
			} satisfies LibraryCollection;
		})
	);

	const genresWithMovies = await Promise.all(
		genres.map(async (genre) => {
			const movies = await libraryRepository.findGenreMovies(genre.name, HOME_LIBRARY_MOVIES_LIMIT);
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

	const decoratedTrending = trendingMovies.map((movie) => decorate(movie as LibraryMovie));
	const decoratedCollections = collectionsWithMovies.map((collection) => ({
		...collection,
		movies: collection.movies.map((movie) => decorate(movie as LibraryMovie))
	}));
	const decoratedGenres = genresWithMovies.map((genre) => ({
		...genre,
		movies: genre.movies.map((movie) => decorate(movie as LibraryMovie))
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
		homeLibraryCache.delete(HOME_LIBRARY_CACHE_KEY);
	}

	const result = await homeLibraryCache.getOrSet(
		HOME_LIBRARY_CACHE_KEY,
		fetchHomeLibraryFromSource
	);
	return clone(result);
}

export function invalidateHomeLibraryCache() {
	homeLibraryCache.delete(HOME_LIBRARY_CACHE_KEY);
}

export const libraryService = {
	fetchHomeLibrary,
	invalidateHomeLibraryCache
};
