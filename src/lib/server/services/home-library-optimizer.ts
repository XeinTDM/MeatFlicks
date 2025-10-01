import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { loadMovieByTmdb, upsertMovieWithGenres } from '$lib/server/db/mutations';
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
	for (const tmdbId of tmdbIds) {
		try {
			const existing = loadMovieByTmdb(tmdbId);
			if (existing) {
				continue;
			}

			const details = await fetchTmdbMovieDetails(tmdbId);
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

			upsertMovieWithGenres({
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
			console.error(`[home-library] Failed to ingest TMDB id ${tmdbId} for ${label}`, error);
		}
	}
};

const runTrendingTask = async () => {
	const ids = await fetchTrendingMovieIds(40);
	await ingestMovies(ids, { label: 'trending' });
};

const runPopularTask = async () => {
	const ids = await fetchPopularMovieIds(40);
	await ingestMovies(ids, { label: 'popular' });
};

const runGenrePoolsTask = async () => {
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
			console.error(`[home-library] Failed to refresh genre pool for ${genre.name}`, error);
		}
	}
};

const runHighRatedTask = async () => {
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
			return;
		}

		for (const task of tasksToRun) {
			try {
				await runTask(task);
				state.lastRun[task] = Date.now();
				await saveState(state);
			} catch (error) {
				console.error(`[home-library] Task ${task} failed`, error);
			}
		}
	})()
		.finally(() => {
			refreshPromise = null;
		});

	return refreshPromise;
};
