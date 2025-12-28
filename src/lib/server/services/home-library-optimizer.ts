import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { logger } from '$lib/server/logger';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import { loadMovieByTmdb } from '$lib/server/db/mutations';
import {
    discoverMovieIds,
    fetchPopularMovieIds,
    fetchTrendingMovieIds,
    fetchTmdbMovieDetails
} from '$lib/server/services/tmdb.service';

const STATE_VERSION = 1;
const STATE_PATH = 'data/home-library-state.json';

type RefreshTaskKey = 'trending' | 'popular' | 'genrePools' | 'highRated';

interface RefreshState {
    version: number;
    lastRun: Record<RefreshTaskKey, number | null>;
}

interface IngestOptions {
    label: string;
    minRating?: number;
}

const DEFAULT_STATE: RefreshState = {
    version: STATE_VERSION,
    lastRun: {
        trending: null,
        popular: null,
        genrePools: null,
        highRated: null
    }
};

const DAY = 1000 * 60 * 60 * 24;

const REFRESH_WINDOWS: Record<RefreshTaskKey, number> = {
    trending: DAY,
    popular: DAY,
    genrePools: DAY,
    highRated: DAY * 7
};

const GENRE_TARGETS: Array<{ id: number; name: string }> = [
    { id: 28, name: 'Action' },
    { id: 35, name: 'Comedy' },
    { id: 18, name: 'Drama' },
    { id: 27, name: 'Horror' },
    { id: 10749, name: 'Romance' },
    { id: 878, name: 'Science Fiction' }
];

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
                highRated: parsed.lastRun.highRated ?? null
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

const ingestMovies = async (tmdbIds: number[], options: IngestOptions) => {
    const { label, minRating } = options;
    const payloads: any[] = [];

    for (const tmdbId of tmdbIds) {
        try {
            const existing = await loadMovieByTmdb(tmdbId);
            if (existing) {
                continue;
            }

            const details = await tmdbRateLimiter.schedule(`ingest-${label}`, () =>
                fetchTmdbMovieDetails(tmdbId)
            );
            if (!details.found) {
                continue;
            }

            const rating = details.rating ?? null;
            if (typeof minRating === 'number' && rating !== null && rating < minRating) {
                continue;
            }

            const genreNames = Array.from(
                new Set(details.genres.map((genre) => genre.name).filter(Boolean))
            );

            logger.debug({ tmdbId, title: details.title, label }, '[home-library] Preparing ingestion');

            payloads.push({
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
                genreNames
            });
        } catch (error) {
            logger.error({ tmdbId, label, error }, '[home-library] Failed to fetch TMDB movie for ingestion');
        }
    }

    if (payloads.length > 0) {
        try {
            const { bulkUpsertMovies } = await import('$lib/server/db/mutations');
            await bulkUpsertMovies(payloads);
            logger.info({ count: payloads.length, label }, '[home-library] Bulk ingestion completed');
        } catch (error) {
            logger.error({ label, error }, '[home-library] Bulk ingestion failed');
        }
    }
};

const runTrendingTask = async () => {
    logger.info('[home-library] Running trending movies refresh task');
    const ids = await fetchTrendingMovieIds(40);
    await ingestMovies(ids, { label: 'trending' });
};

const runPopularTask = async () => {
    logger.info('[home-library] Running popular movies refresh task');
    const ids = await fetchPopularMovieIds(40);
    await ingestMovies(ids, { label: 'popular' });
};

const runGenrePoolsTask = async () => {
    logger.info('[home-library] Running genre pools refresh task');
    for (const genre of GENRE_TARGETS) {
        try {
            const ids = await discoverMovieIds({
                genreId: genre.id,
                limit: 30,
                minVoteAverage: 6.5,
                minVoteCount: 200,
                sortBy: 'popularity.desc'
            });
            await ingestMovies(ids, { label: `genre:${genre.name}`, minRating: 6 });
        } catch (error) {
            logger.error({ genre: genre.name, error }, '[home-library] Failed to refresh genre pool');
        }
    }
};

const runHighRatedTask = async () => {
    logger.info('[home-library] Running high-rated movies refresh task');
    const ids = await discoverMovieIds({
        limit: 60,
        minVoteAverage: 7.5,
        minVoteCount: 500,
        sortBy: 'vote_average.desc'
    });
    await ingestMovies(ids, { label: 'high-rated', minRating: 7 });
};

const TASK_ORDER: RefreshTaskKey[] = ['trending', 'popular', 'genrePools', 'highRated'];

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
