import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { logger } from '$lib/server/logger';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import { loadMovieByTmdb, bulkUpsertMovies, type UpsertMoviePayload } from '$lib/server/db/mutations';
import {
	discoverMovieIds,
	discoverTvIds,
	fetchPopularMovieIds,
	fetchPopularTvIds,
	fetchTrendingMovieIds,
	fetchTrendingTvIds,
	fetchTmdbMovieDetails,
	fetchTmdbTvDetails
} from '$lib/server/services/tmdb.service';

const STATE_VERSION = 1;
const STATE_PATH = 'data/home-library-state.json';

type RefreshTaskKey =
	| 'trending'
	| 'popular'
	| 'genrePools'
	| 'highRated'
	| 'trendingTv'
	| 'popularTv'
	| 'genrePoolsTv'
	| 'anime'
	| 'animeTv';

interface RefreshState {
	version: number;
	lastRun: Record<RefreshTaskKey, number | null>;
}

interface IngestOptions {
	label: string;
	minRating?: number;
	mediaType: 'movie' | 'tv' | 'anime';
	tmdbMediaType?: 'movie' | 'tv';
}

const DEFAULT_STATE: RefreshState = {
	version: STATE_VERSION,
	lastRun: {
		trending: null,
		popular: null,
		genrePools: null,
		highRated: null,
		trendingTv: null,
		popularTv: null,
		genrePoolsTv: null,
		anime: null,
		animeTv: null
	}
};

const DAY = 1000 * 60 * 60 * 24;

const REFRESH_WINDOWS: Record<RefreshTaskKey, number> = {
	trending: DAY,
	popular: DAY,
	genrePools: DAY,
	highRated: DAY * 7,
	trendingTv: DAY,
	popularTv: DAY,
	genrePoolsTv: DAY,
	anime: DAY,
	animeTv: DAY
};

const GENRE_TARGETS: Array<{ id: number; name: string }> = [
	{ id: 28, name: 'Action' },
	{ id: 35, name: 'Comedy' },
	{ id: 18, name: 'Drama' },
	{ id: 27, name: 'Horror' },
	{ id: 10749, name: 'Romance' },
	{ id: 878, name: 'Science Fiction' }
];

const TV_GENRE_TARGETS: Array<{ id: number; name: string }> = [
	{ id: 10759, name: 'Action & Adventure' },
	{ id: 16, name: 'Animation' },
	{ id: 35, name: 'Comedy' },
	{ id: 18, name: 'Drama' },
	{ id: 10765, name: 'Sci-Fi & Fantasy' }
];

const TRENDING_FETCH_LIMIT = 50;
const POPULAR_FETCH_LIMIT = 50;
const HIGH_RATED_FETCH_LIMIT = 75;
const GENRE_FETCH_LIMIT = 50;

const BATCH_SIZE = 20;

let refreshPromise: Promise<void> | null = null;

const ensureDataDirectory = async () => {
	await mkdir('data', { recursive: true });
};

const loadState = async (): Promise<RefreshState> => {
	try {
		const raw = await readFile(STATE_PATH, 'utf8');
		const parsed = JSON.parse(raw) as Partial<RefreshState>;
		if (typeof parsed.version !== 'number' || !parsed.lastRun) {
			return { ...DEFAULT_STATE };
		}
		return {
			version: STATE_VERSION,
			lastRun: {
				trending: parsed.lastRun.trending ?? null,
				popular: parsed.lastRun.popular ?? null,
				genrePools: parsed.lastRun.genrePools ?? null,
				highRated: parsed.lastRun.highRated ?? null,
				trendingTv: (parsed.lastRun as any).trendingTv ?? null,
				popularTv: (parsed.lastRun as any).popularTv ?? null,
				genrePoolsTv: (parsed.lastRun as any).genrePoolsTv ?? null,
				anime: (parsed.lastRun as any).anime ?? null,
				animeTv: (parsed.lastRun as any).animeTv ?? null
			}
		};
	} catch (error) {
		return { ...DEFAULT_STATE };
	}
};

const saveState = async (state: RefreshState): Promise<void> => {
	await ensureDataDirectory();
	await writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
};

const isTaskDue = (state: RefreshState, task: RefreshTaskKey): boolean => {
	const lastRun = state.lastRun[task];
	if (!lastRun) return true;
	const windowMs = REFRESH_WINDOWS[task];
	return Date.now() - lastRun >= windowMs;
};

const ingestMedia = async (tmdbIds: number[], options: IngestOptions) => {
	const { label, minRating, mediaType } = options;

	for (let i = 0; i < tmdbIds.length; i += BATCH_SIZE) {
		const batchIds = tmdbIds.slice(i, i + BATCH_SIZE);
		const currentBatchPayloads: any[] = [];

		const fetchPromises = batchIds.map(async (tmdbId) => {
			try {
				const existing = await loadMovieByTmdb(tmdbId);
				if (existing && existing.mediaType === mediaType) {
					return null;
				}

				const tmdbMediaType = options.tmdbMediaType ?? (mediaType === 'anime' ? 'tv' : mediaType);

				let details;
				if (tmdbMediaType === 'movie') {
					details = await tmdbRateLimiter.schedule(`ingest-${label}`, () =>
						fetchTmdbMovieDetails(tmdbId)
					);
				} else {
					const tvDetails = await tmdbRateLimiter.schedule(`ingest-${label}`, () =>
						fetchTmdbTvDetails(tmdbId)
					);
					details = {
						found: tvDetails.found,
						title: tvDetails.name,
						overview: tvDetails.overview,
						posterPath: tvDetails.posterPath,
						backdropPath: tvDetails.backdropPath,
						releaseDate: tvDetails.firstAirDate,
						rating: tvDetails.rating,
						durationMinutes: tvDetails.episodeRuntimes?.[0] ?? null,
						genres: tvDetails.genres,
						imdbId: tvDetails.imdbId,
						trailerUrl: tvDetails.trailerUrl
					};
				}

				if (!details.found) {
					return null;
				}

				const rating = details.rating ?? null;
				if (typeof minRating === 'number' && rating !== null && rating < minRating) {
					return null;
				}

				const genreNames = Array.from(
					new Set(details.genres.map((genre) => genre.name).filter(Boolean))
				);

				logger.debug(
					{ tmdbId, title: details.title, label, mediaType },
					'[home-library] Preparing ingestion for batch'
				);

				return {
					tmdbId,
					title: details.title ?? 'Untitled',
					overview: details.overview ?? null,
					posterPath: details.posterPath ?? null,
					backdropPath: details.backdropPath ?? null,
					releaseDate: details.releaseDate ?? null,
					rating,
					durationMinutes: details.runtime ?? null,
					is4K: false,
					isHD: true,
					genreNames,
					mediaType,
					imdbId: details.imdbId ?? null,
					trailerUrl: details.trailerUrl ?? null
				};
			} catch (error) {
				logger.error(
					{ tmdbId, label, error, mediaType },
					'[home-library] Failed to fetch TMDB data for ingestion in batch'
				);
				return null;
			}
		});

		const fetchedPayloads = await Promise.all(fetchPromises);
		const validPayloads = fetchedPayloads.filter(Boolean) as UpsertMoviePayload[];

		if (validPayloads.length > 0) {
			try {
				const { bulkUpsertMovies } = await import('$lib/server/db/mutations');
				await bulkUpsertMovies(validPayloads);
				logger.info(
					{ count: validPayloads.length, label, mediaType, batchIndex: i / BATCH_SIZE },
					'[home-library] Batch ingestion completed'
				);
			} catch (error) {
				logger.error({ label, error, mediaType, batchIndex: i / BATCH_SIZE }, '[home-library] Batch ingestion failed');
			}
		}
	}
};

const runTrendingTask = async () => {
	logger.info('[home-library] Running trending movies refresh task');
	const ids = await fetchTrendingMovieIds(TRENDING_FETCH_LIMIT);
	await ingestMedia(ids, { label: 'trending', mediaType: 'movie' });
};

const runPopularTask = async () => {
	logger.info('[home-library] Running popular movies refresh task');
	const ids = await fetchPopularMovieIds(POPULAR_FETCH_LIMIT);
	await ingestMedia(ids, { label: 'popular', mediaType: 'movie' });
};

const runGenrePoolsTask = async () => {
	logger.info('[home-library] Running genre pools refresh task');
	for (const genre of GENRE_TARGETS) {
		try {
			const ids = await discoverMovieIds({
				genreId: genre.id,
				limit: GENRE_FETCH_LIMIT,
				minVoteAverage: 6.0,
				minVoteCount: 100,
				sortBy: 'popularity.desc'
			});
			await ingestMedia(ids, { label: `genre:${genre.name}`, minRating: 5.5, mediaType: 'movie' });
		} catch (error) {
			logger.error({ genre: genre.name, error }, '[home-library] Failed to refresh genre pool');
		}
	}
};

const runHighRatedTask = async () => {
	logger.info('[home-library] Running high-rated movies refresh task');
	const ids = await discoverMovieIds({
		limit: HIGH_RATED_FETCH_LIMIT,
		minVoteAverage: 7.5,
		minVoteCount: 500,
		sortBy: 'vote_average.desc'
	});
	await ingestMedia(ids, { label: 'high-rated', minRating: 7, mediaType: 'movie' });
};

const runTrendingTvTask = async () => {
	logger.info('[home-library] Running trending TV refresh task');
	const ids = await fetchTrendingTvIds(TRENDING_FETCH_LIMIT);
	await ingestMedia(ids, { label: 'trending-tv', mediaType: 'tv' });
};

const runPopularTvTask = async () => {
	logger.info('[home-library] Running popular TV refresh task');
	const ids = await fetchPopularTvIds(POPULAR_FETCH_LIMIT);
	await ingestMedia(ids, { label: 'popular-tv', mediaType: 'tv' });
};

const runGenrePoolsTvTask = async () => {
	logger.info('[home-library] Running genre pools TV refresh task');
	for (const genre of TV_GENRE_TARGETS) {
		try {
			const ids = await discoverTvIds({
				genreId: genre.id,
				limit: GENRE_FETCH_LIMIT,
				minVoteAverage: 6.0,
				minVoteCount: 100,
				sortBy: 'popularity.desc'
			});
			await ingestMedia(ids, { label: `tv-genre:${genre.name}`, minRating: 5.5, mediaType: 'tv' });
		} catch (error) {
			logger.error({ genre: genre.name, error }, '[home-library] Failed to refresh TV genre pool');
		}
	}
};

const runAnimeTask = async () => {
	logger.info('[home-library] Running anime movies refresh task');
	const ids = await discoverMovieIds({
		genreId: 16,
		limit: TRENDING_FETCH_LIMIT,
		minVoteAverage: 6.0,
		sortBy: 'popularity.desc'
	});
	await ingestMedia(ids, { label: 'anime-movies', mediaType: 'anime', tmdbMediaType: 'movie' });
};

const runAnimeTvTask = async () => {
	logger.info('[home-library] Running anime TV refresh task');
	const ids = await discoverTvIds({
		genreId: 16,
		limit: TRENDING_FETCH_LIMIT,
		minVoteAverage: 6.0,
		sortBy: 'popularity.desc'
	});
	await ingestMedia(ids, { label: 'anime-tv', mediaType: 'anime', tmdbMediaType: 'tv' });
};

const TASK_ORDER: RefreshTaskKey[] = [
	'trending',
	'popular',
	'genrePools',
	'highRated',
	'trendingTv',
	'popularTv',
	'genrePoolsTv',
	'anime',
	'animeTv'
];

const runTask = async (task: RefreshTaskKey) => {
	switch (task) {
		case 'trending':
			await runTrendingTask();
			break;
		case 'popular':
			await runPopularTask();
			break;
		case 'genrePools':
			await runGenrePoolsTask();
			break;
		case 'highRated':
			await runHighRatedTask();
			break;
		case 'trendingTv':
			await runTrendingTvTask();
			break;
		case 'popularTv':
			await runPopularTvTask();
			break;
		case 'genrePoolsTv':
			await runGenrePoolsTvTask();
			break;
		case 'anime':
			await runAnimeTask();
			break;
		case 'animeTv':
			await runAnimeTvTask();
			break;
	}
};

export interface EnsureHomeLibraryOptions {
	force?: boolean;
}

export const ensureHomeLibraryPrimed = async (
	options: EnsureHomeLibraryOptions = {}
): Promise<void> => {
	if (refreshPromise) {
		return refreshPromise;
	}

	refreshPromise = (async () => {
		const state = await loadState();
		const tasksToRun = options.force
			? [...TASK_ORDER]
			: TASK_ORDER.filter((task) => isTaskDue(state, task));

		if (tasksToRun.length === 0) {
			logger.debug('[home-library] All refresh tasks are up to date');
			return;
		}

		logger.info({ tasksToRun }, '[home-library] Starting library priming tasks');

		for (const task of tasksToRun) {
			try {
				await runTask(task);
				state.lastRun[task] = Date.now();
				await saveState(state);
			} catch (error) {
				logger.error({ task, error }, '[home-library] Refresh task failed');
			}
		}
	})().finally(() => {
		refreshPromise = null;
	});

	return refreshPromise;
};
