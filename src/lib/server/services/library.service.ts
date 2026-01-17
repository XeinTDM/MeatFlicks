import { withCache, CACHE_TTL_MEDIUM_SECONDS } from '$lib/server/cache';
import { toSlug } from '$lib/utils';
import { updateLastRefreshTime } from '$lib/server/utils';
import { logger } from '$lib/server/logger';
import { libraryRepository } from '$lib/server/repositories/library.repository';
import { ensureHomeLibraryPrimed } from '$lib/server/services/home-library-optimizer';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import type { MediaSummary } from '$lib/server/db';
import type {
	HomeLibrary,
	LibraryCollection,
	LibraryGenre,
	LibraryMedia
} from '$lib/types/library';
import {
	fetchTmdbMovieDetails,
	fetchTmdbMovieExtras,
	fetchTrendingMovieIds,
	fetchTrendingTvIds,
	type TmdbMovieDetails,
	type TmdbMovieGenre
} from '$lib/server/services/tmdb.service';

const HOME_LIBRARY_CACHE_KEY = 'home-library';
const HOME_LIBRARY_ITEMS_LIMIT = 10;
const HOME_LIBRARY_COLLECTIONS_LIMIT = 10;
const HOME_LIBRARY_GENRES_LIMIT = 10;

const toLibraryMedia = (media: MediaSummary): LibraryMedia => ({
	...media,
	releaseDate: media.releaseDate ?? null,
	durationMinutes: media.durationMinutes ?? null,
	genres: media.genres ?? []
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
		const { media: mediaTable } = await import('$lib/server/db/schema');
		const { eq } = await import('drizzle-orm');
		const storedMedia: MediaSummary[] = [];

		for (const details of detailsList.filter((d): d is TmdbMovieDetails => Boolean(d?.found))) {
			try {
				const genreNames = Array.from(
					new Set(details.genres.map((genre) => genre.name).filter(Boolean))
				);

				logger.info(
					{ tmdbId: details.tmdbId, title: details.title },
					'[library][fallback] Storing media'
				);

				const storedItem = await upsertMovieWithGenres({
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

				if (storedItem) {
					logger.info(
						{ mediaId: storedItem.id, imdbId: details.imdbId },
						'[library][fallback] Media stored, updating IMDB ID'
					);

					await db
						.update(mediaTable)
						.set({
							imdbId: details.imdbId,
							trailerUrl: details.trailerUrl,
							updatedAt: Date.now()
						})
						.where(eq(mediaTable.id, storedItem.id));

					storedMedia.push(storedItem);
				} else {
					logger.warn({ tmdbId: details.tmdbId }, '[library][fallback] Failed to store media');
				}
			} catch (error) {
				logger.warn({ tmdbId: details.tmdbId, error }, '[library][fallback] failed to store media');
			}
		}

		if (storedMedia.length === 0) {
			return null;
		}

		const fallbackMedia = storedMedia.map((item) => {
			const libraryItem = toLibraryMedia(item);
			const type = libraryItem.mediaType || libraryItem.media_type || 'movie';
			const prefix = type === 'tv' ? '/tv/' : '/movie/';
			const canonicalPath = item.tmdbId
				? `${prefix}${item.tmdbId}`
				: item.imdbId
					? `${prefix}${item.imdbId}`
					: `${prefix}${item.id}`;
			return {
				...libraryItem,
				canonicalPath
			};
		});

		return {
			trendingMovies: fallbackMedia,
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
	items: LibraryMedia[]
): Promise<Map<number, { imdbId: string | null; trailerUrl: string | null }>> => {
	const itemsMissingData = items.filter(
		(m) => m.tmdbId && (!m.imdbId || !m.trailerUrl)
	);

	const uniqueIds = Array.from(
		new Set(
			itemsMissingData
				.map((m) => m.tmdbId)
				.filter((id): id is number => typeof id === 'number' && id > 0)
		)
	);

	const extrasMap = new Map<number, { imdbId: string | null; trailerUrl: string | null }>();

	for (const item of items) {
		if (item.tmdbId && item.imdbId && item.trailerUrl) {
			extrasMap.set(item.tmdbId, {
				imdbId: item.imdbId,
				trailerUrl: item.trailerUrl
			});
		}
	}

	if (uniqueIds.length === 0) {
		return extrasMap;
	}

	logger.info(
		{ count: uniqueIds.length, total: items.length },
		'[library][tmdb] Fetching extras for items missing data'
	);

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
	media: LibraryMedia,
	extrasMap: Map<number, { imdbId: string | null; trailerUrl: string | null }>
): LibraryMedia => {
	const extras = media.tmdbId ? (extrasMap.get(media.tmdbId) ?? null) : null;
	const imdbId = extras?.imdbId ?? null;
	const trailerUrl = extras?.trailerUrl ?? media.trailerUrl ?? null;

	const type = media.mediaType || media.media_type || 'movie';
	const prefix = type === 'tv' ? '/tv/' : '/movie/';
	const canonicalPath = media.tmdbId ? prefix + media.tmdbId : prefix + (imdbId ?? media.id);

	return {
		...media,
		imdbId,
		trailerUrl,
		canonicalPath
	} satisfies LibraryMedia;
};

async function fetchHomeLibraryFromSource(): Promise<HomeLibrary> {
	const [trendingMoviesRaw, trendingTvRaw, collectionsRaw, genresRaw] = await Promise.all([
		libraryRepository.findTrendingMovies(HOME_LIBRARY_ITEMS_LIMIT, 'movie'),
		libraryRepository.findTrendingMovies(HOME_LIBRARY_ITEMS_LIMIT, 'tv'),
		libraryRepository.listCollections(),
		libraryRepository.listGenres()
	]);

	const collections = collectionsRaw.slice(0, HOME_LIBRARY_COLLECTIONS_LIMIT);
	const genres = genresRaw.slice(0, HOME_LIBRARY_GENRES_LIMIT);

	const trendingMovies = trendingMoviesRaw.map(toLibraryMedia);
	const trendingTv = trendingTvRaw.map(toLibraryMedia);

	const collectionsWithMedia = await Promise.all(
		collections.map(async (collection) => {
			const media = await libraryRepository
				.findCollectionMovies(collection.slug, HOME_LIBRARY_ITEMS_LIMIT)
				.then((items) => items.map(toLibraryMedia));
			return {
				...collection,
				media,
				movies: media // Compatibility
			} satisfies LibraryCollection;
		})
	);

	const genresWithMedia = await Promise.all(
		genres.map(async (genre) => {
			const media = await libraryRepository
				.findGenreMovies(genre.name, HOME_LIBRARY_ITEMS_LIMIT)
				.then((items) => items.map(toLibraryMedia));
			return {
				...genre,
				slug: toSlug(genre.name),
				media,
				movies: media // Compatibility
			} satisfies LibraryGenre;
		})
	);

	const allMedia = [
		...trendingMovies,
		...trendingTv,
		...collectionsWithMedia.flatMap((collection) => collection.media),
		...genresWithMedia.flatMap((genre) => genre.media)
	];

	const extrasMap = await buildExtrasMap(allMedia);

	const decorate = (media: LibraryMedia) => attachIdentifiers(media, extrasMap);

	const decoratedTrendingMovies = trendingMovies.map(decorate);
	const decoratedTrendingTv = trendingTv.map(decorate);
	const decoratedCollections = collectionsWithMedia.map((collection) => ({
		...collection,
		media: collection.media.map(decorate),
		movies: collection.media.map(decorate)
	}));
	const decoratedGenres = genresWithMedia.map((genre) => ({
		...genre,
		media: genre.media.map(decorate),
		movies: genre.media.map(decorate)
	}));

	return {
		trendingMovies: decoratedTrendingMovies,
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

	// Start priming in the background if needed, but don't block the initial fetch
	ensureHomeLibraryPrimed({ force: forceRefresh }).catch((error) => {
		logger.error({ error }, '[library] Failed to prime home library data');
	});

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
				const fallback = await buildFallbackHomeLibrary(HOME_LIBRARY_ITEMS_LIMIT);
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