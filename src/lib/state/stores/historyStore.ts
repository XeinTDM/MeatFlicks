import { writable, get } from 'svelte/store';
import type { Movie } from './watchlistStore.svelte';

export type HistoryEntry = Omit<Movie, 'addedAt'> & {
	watchedAt: string;
	mediaType?: string;
	season?: number;
	episode?: number;
};

type HistoryState = {
	entries: HistoryEntry[];
	error: string | null;
};

const STORAGE_KEY = 'meatflicks.history';
const hasStorage = typeof localStorage !== 'undefined';

const resolveCanonicalPath = (
	payload: Partial<Movie> & Record<string, unknown>,
	id: string
): string => {
	const provided = typeof payload.canonicalPath === 'string' ? payload.canonicalPath.trim() : '';
	if (provided) {
		return provided.startsWith('/') ? provided : `/${provided}`;
	}

	const type = payload.mediaType || payload.media_type || 'movie';
	const prefix = type === 'tv' ? '/tv/' : '/movie/';

	const imdbId = typeof payload.imdbId === 'string' ? payload.imdbId.trim() : '';
	if (imdbId) {
		return `${prefix}${imdbId}`;
	}

	const tmdbId =
		typeof payload.tmdbId === 'number' && Number.isFinite(payload.tmdbId) ? payload.tmdbId : null;

	if (tmdbId) {
		return `${prefix}${tmdbId}`;
	}

	return `${prefix}${id}`;
};

const sanitizeEntry = (candidate: unknown): HistoryEntry | null => {
	if (!candidate || typeof candidate !== 'object') {
		return null;
	}

	const payload = candidate as Partial<HistoryEntry> & Record<string, unknown>;
	const id = typeof payload.id === 'string' ? payload.id : String(payload.id ?? '');
	const title = typeof payload.title === 'string' ? payload.title : String(payload.title ?? '');
	const watchedAt =
		typeof payload.watchedAt === 'string' ? payload.watchedAt : String(payload.watchedAt ?? '');

	if (!id || !watchedAt) {
		return null;
	}

	const ratingValue = Number(payload.rating ?? 0);

	return {
		id,
		title,
		posterPath: typeof payload.posterPath === 'string' ? payload.posterPath : '',
		backdropPath: typeof payload.backdropPath === 'string' ? payload.backdropPath : '',
		overview: typeof payload.overview === 'string' ? payload.overview : '',
		releaseDate: typeof payload.releaseDate === 'string' ? payload.releaseDate : '',
		rating: Number.isFinite(ratingValue) ? ratingValue : 0,
		genres: Array.isArray(payload.genres) ? payload.genres.map(String) : [],
		trailerUrl: typeof payload.trailerUrl === 'string' ? payload.trailerUrl : undefined,
		tmdbId: typeof payload.tmdbId === 'number' ? payload.tmdbId : undefined,
		imdbId: typeof payload.imdbId === 'string' ? payload.imdbId : null,
		canonicalPath: resolveCanonicalPath(payload, id),
		durationMinutes: typeof payload.durationMinutes === 'number' ? payload.durationMinutes : null,
		collectionId: typeof payload.collectionId === 'number' ? payload.collectionId : null,
		is4K: payload.is4K === true,
		isHD: typeof payload.isHD === 'boolean' ? payload.isHD : undefined,
		media_type: typeof payload.media_type === 'string' ? payload.media_type : undefined,
		season: typeof payload.season === 'number' ? payload.season : undefined,
		episode: typeof payload.episode === 'number' ? payload.episode : undefined,
		watchedAt
	} satisfies HistoryEntry;
};

const readStorage = (): HistoryEntry[] => {
	if (!hasStorage) {
		return [];
	}

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return [];
		}

		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed
			.map(sanitizeEntry)
			.filter((entry): entry is HistoryEntry => Boolean(entry))
			.sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1));
	} catch (error) {
		console.error('[history][readStorage] Failed to parse persisted data', error);
		return [];
	}
};

const persist = (entries: HistoryEntry[]) => {
	if (!hasStorage) {
		return;
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
	} catch (error) {
		console.error('[history][persist] Failed to write data', error);
	}
};

const normalizeForHistory = (
	movie: Partial<Movie> & Record<string, unknown>
): HistoryEntry | null => {
	const id = typeof movie.id === 'string' ? movie.id : String(movie.id ?? '');
	const title = typeof movie.title === 'string' ? movie.title : String(movie.title ?? '');

	if (!id || !title) {
		return null;
	}

	const ratingValue = Number(movie.rating ?? 0);
	const timestamp = new Date().toISOString();

	return {
		id,
		title,
		posterPath: typeof movie.posterPath === 'string' ? movie.posterPath : '',
		backdropPath: typeof movie.backdropPath === 'string' ? movie.backdropPath : '',
		overview: typeof movie.overview === 'string' ? movie.overview : '',
		releaseDate: typeof movie.releaseDate === 'string' ? movie.releaseDate : '',
		rating: Number.isFinite(ratingValue) ? ratingValue : 0,
		genres: Array.isArray(movie.genres) ? movie.genres.map(String) : [],
		trailerUrl: typeof movie.trailerUrl === 'string' ? movie.trailerUrl : undefined,
		tmdbId: typeof movie.tmdbId === 'number' ? movie.tmdbId : undefined,
		imdbId: typeof movie.imdbId === 'string' ? movie.imdbId : null,
		canonicalPath: resolveCanonicalPath(movie, id),
		durationMinutes: typeof movie.durationMinutes === 'number' ? movie.durationMinutes : null,
		collectionId: typeof movie.collectionId === 'number' ? movie.collectionId : null,
		is4K: movie.is4K === true,
		isHD: typeof movie.isHD === 'boolean' ? movie.isHD : undefined,
		media_type: typeof movie.media_type === 'string' ? (movie.media_type as string) : undefined,
		season: typeof movie.season === 'number' ? movie.season : undefined,
		episode: typeof movie.episode === 'number' ? movie.episode : undefined,
		watchedAt: timestamp
	} satisfies HistoryEntry;
};

function createHistoryStore() {
	const initialState: HistoryState = {
		entries: [],
		error: null
	};

	const store = writable<HistoryState>(initialState);

	const syncFromStorage = () => {
		const stored = readStorage();
		store.update((state) => ({ ...state, entries: stored, error: null }));
	};

	if (hasStorage && typeof window !== 'undefined') {
		syncFromStorage();
		window.addEventListener('storage', (event) => {
			if (event.key === STORAGE_KEY) {
				syncFromStorage();
			}
		});
	}

	const setError = (message: string) => {
		store.update((state) => ({ ...state, error: message }));
	};

	const clearError = () => {
		store.update((state) => ({ ...state, error: null }));
	};

	const recordWatch = (movie: Partial<Movie> & Record<string, unknown>) => {
		const entry = normalizeForHistory(movie);

		if (!entry) {
			setError('Unable to record history entry. Movie is missing required data.');
			return;
		}

		store.update((state) => {
			const filtered = state.entries.filter((existing) => existing.id !== entry.id);
			const updated = [entry, ...filtered].sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1));
			persist(updated);
			return { ...state, entries: updated, error: null };
		});
	};

	const remove = (movieId: string) => {
		if (!movieId) {
			setError('Movie id is required to remove history entry.');
			return;
		}

		store.update((state) => {
			const updated = state.entries.filter((entry) => entry.id !== movieId);
			persist(updated);
			return { ...state, entries: updated, error: null };
		});
	};

	const replaceAll = (entries: HistoryEntry[]) => {
		const sanitized = entries
			.map(sanitizeEntry)
			.filter((entry): entry is HistoryEntry => Boolean(entry))
			.sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1));

		store.update((state) => ({ ...state, entries: sanitized, error: null }));
		persist(sanitized);
	};

	const clear = () => {
		store.set({ ...initialState });
		persist([]);
	};

	const exportData = () => structuredClone(get(store).entries);

	return {
		subscribe: store.subscribe,
		recordWatch,
		remove,
		replaceAll,
		clear,
		exportData,
		clearError,
		setError
	};
}

export const watchHistory = createHistoryStore();
