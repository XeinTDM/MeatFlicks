import { writable, get } from 'svelte/store';
import type { LibraryMovie } from '$lib/types/library';
import { notifications } from './notificationStore';

export type Movie = {
	id: string;
	title: string;
	posterPath: string | null;
	backdropPath: string | null;
	overview: string | null;
	releaseDate: string | null;
	rating: number;
	genres: string[];
	trailerUrl?: string | null;
	media_type?: string;
	mediaType?: string;
	is4K?: boolean;
	isHD?: boolean;
	tmdbId?: number;
	imdbId?: string | null;
	canonicalPath?: string;
	durationMinutes?: number | null;
	collectionId?: number | null;
	addedAt: string;
	season?: number | null;
	episode?: number | null;
};

type WatchlistCandidate = LibraryMovie | Movie | (Partial<Movie> & Record<string, unknown>);

interface WatchlistState {
	watchlist: Movie[];
	loading: boolean;
	error: string | null;
}

const STORAGE_KEY = 'meatflicks.watchlist';
const hasStorage = typeof localStorage !== 'undefined';

const normalizeDateString = (value: unknown): string | null => {
	if (typeof value !== 'string') {
		return null;
	}

	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) {
		return null;
	}

	return new Date(parsed).toISOString();
};

const buildCanonicalPath = (
	payload: Partial<Movie> & Record<string, unknown>,
	id: string
): string => {
	const fromPayload = typeof payload.canonicalPath === 'string' ? payload.canonicalPath.trim() : '';
	if (fromPayload) {
		return fromPayload.startsWith('/') ? fromPayload : `/${fromPayload}`;
	}

	const imdbId = typeof payload.imdbId === 'string' ? payload.imdbId.trim() : '';
	if (imdbId) {
		return `/movie/${imdbId}`;
	}

	const tmdbId =
		typeof payload.tmdbId === 'number' && Number.isFinite(payload.tmdbId) ? payload.tmdbId : null;

	if (tmdbId) {
		return `/movie/${tmdbId}`;
	}

	return `/movie/${id}`;
};

const sanitizeMovie = (candidate: unknown): Movie | null => {
	if (!candidate || typeof candidate !== 'object') {
		return null;
	}

	const payload = candidate as Partial<Movie> & Record<string, unknown>;
	const id = typeof payload.id === 'string' ? payload.id : String(payload.id ?? '');
	const title = typeof payload.title === 'string' ? payload.title : String(payload.title ?? '');

	if (!id) {
		return null;
	}

	const ratingValue = Number(payload.rating ?? 0);
	const addedAt = normalizeDateString(payload.addedAt) ?? new Date().toISOString();

	return {
		id,
		title,
		posterPath: typeof payload.posterPath === 'string' ? payload.posterPath : null,
		backdropPath: typeof payload.backdropPath === 'string' ? payload.backdropPath : null,
		overview: typeof payload.overview === 'string' ? payload.overview : null,
		releaseDate: typeof payload.releaseDate === 'string' ? payload.releaseDate : null,
		rating: Number.isFinite(ratingValue) ? ratingValue : 0,
		genres: Array.isArray(payload.genres) ? payload.genres.map(String) : [],
		trailerUrl: typeof payload.trailerUrl === 'string' ? payload.trailerUrl : null,
		media_type: typeof payload.media_type === 'string' ? payload.media_type : undefined,
		mediaType: typeof payload.mediaType === 'string' ? payload.mediaType : undefined,
		is4K: payload.is4K === true,
		isHD: typeof payload.isHD === 'boolean' ? payload.isHD : undefined,
		tmdbId: typeof payload.tmdbId === 'number' ? payload.tmdbId : undefined,
		imdbId: typeof payload.imdbId === 'string' ? payload.imdbId : null,
		canonicalPath: buildCanonicalPath(payload, id),
		durationMinutes: typeof payload.durationMinutes === 'number' ? payload.durationMinutes : null,
		collectionId: typeof payload.collectionId === 'number' ? payload.collectionId : null,
		season: typeof payload.season === 'number' ? payload.season : null,
		episode: typeof payload.episode === 'number' ? payload.episode : null,
		addedAt
	} satisfies Movie;
};

const readStorage = (): Movie[] => {
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
			.map(sanitizeMovie)
			.filter((movie): movie is Movie => Boolean(movie))
			.reduce<Movie[]>((accumulator, movie) => {
				return accumulator.some((existing) => existing.id === movie.id)
					? accumulator
					: [...accumulator, movie];
			}, []);
	} catch (error) {
		console.error('[watchlist][readStorage] Failed to parse persisted data', error);
		return [];
	}
};

const persist = (watchlist: Movie[]) => {
	if (!hasStorage) {
		return;
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
	} catch (error) {
		console.error('[watchlist][persist] Failed to write data', error);
	}
};

function createWatchlistStore() {
	const initialState: WatchlistState = {
		watchlist: [],
		loading: false,
		error: null
	};

	const store = writable<WatchlistState>(initialState);

	const syncFromServer = async () => {
		if (typeof window === 'undefined') return;

		store.update((state) => ({ ...state, loading: true }));
		try {
			const response = await fetch('/api/watchlist', {
				credentials: 'include'
			});
			if (response.ok) {
				const serverMovies = await response.json();
				const sanitized = serverMovies
					.map(sanitizeMovie)
					.filter((movie: Movie | null): movie is Movie => Boolean(movie));

				if (sanitized.length > 0) {
					store.update((state) => ({
						...state,
						watchlist: sanitized,
						loading: false,
						error: null
					}));
					persist(sanitized);
				} else {
					const stored = readStorage();
					store.update((state) => ({
						...state,
						watchlist: stored,
						loading: false,
						error: null
					}));
				}
			} else {
				const stored = readStorage();
				store.update((state) => ({
					...state,
					watchlist: stored,
					loading: false,
					error: null
				}));
			}
		} catch (error) {
			console.error('[watchlist][syncFromServer] Failed', error);
			const stored = readStorage();
			store.update((state) => ({
				...state,
				watchlist: stored,
				loading: false,
				error: null
			}));
		}
	};

	if (typeof window !== 'undefined') {
		syncFromServer();
		window.addEventListener('storage', (event) => {
			if (event.key === STORAGE_KEY) {
				const stored = readStorage();
				store.update((state) => ({ ...state, watchlist: stored }));
			}
		});
	}

	const setError = (message: string) => {
		store.update((state) => ({ ...state, error: message }));
	};

	const clearError = () => {
		store.update((state) => ({ ...state, error: null }));
	};

	const addToWatchlist = async (movie: WatchlistCandidate) => {
		const sanitized = sanitizeMovie(movie);

		if (!sanitized) {
			setError('Unable to add movie to watchlist. Missing required fields.');
			notifications.error('Error', 'Unable to add movie. Missing data.');
			return;
		}

		const previousState = get(store).watchlist;

		store.update((state) => {
			const existing = state.watchlist.find((item) => item.id === sanitized.id);
			const updatedEntry = existing ? { ...sanitized, addedAt: existing.addedAt } : sanitized;

			const updated = existing
				? state.watchlist.map((item) => (item.id === sanitized.id ? updatedEntry : item))
				: [...state.watchlist, updatedEntry];

			persist(updated);
			return { ...state, watchlist: updated, error: null };
		});

		try {
			const response = await fetch('/api/watchlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ movie: sanitized }),
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Failed to sync with server');

			const wasAlreadyIn = previousState.some((i) => i.id === sanitized.id);
			if (!wasAlreadyIn) {
				notifications.movieAdded({
					title: sanitized.title,
					posterPath: sanitized.posterPath,
					tmdbId: sanitized.tmdbId ?? 0
				});
			} else {
				notifications.success('Updated', `Updated "${sanitized.title}" in your watchlist.`);
			}
		} catch (error) {
			console.error('[watchlist][addToWatchlist] sync failed', error);
			store.update((state) => {
				persist(previousState);
				return { ...state, watchlist: previousState, error: 'Failed to sync with server.' };
			});
			notifications.error('Sync Error', 'Failed to save to server. Reverting.');
		}
	};

	const removeFromWatchlist = async (movieId: string) => {
		if (!movieId) {
			setError('Movie id is required to remove from watchlist.');
			return;
		}

		const previousState = get(store).watchlist;
		const movieTitle = previousState.find((m) => m.id === movieId)?.title ?? 'Movie';

		store.update((state) => {
			const updated = state.watchlist.filter((movie) => movie.id !== movieId);
			persist(updated);
			return { ...state, watchlist: updated, error: null };
		});

		try {
			const response = await fetch('/api/watchlist', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ movieId }),
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Failed to sync removal with server');

			notifications.info('Removed', `Removed "${movieTitle}" from watchlist.`);
		} catch (error) {
			console.error('[watchlist][removeFromWatchlist] sync failed', error);
			store.update((state) => {
				persist(previousState);
				return { ...state, watchlist: previousState, error: 'Failed to sync removal with server.' };
			});
			notifications.error('Sync Error', 'Failed to remove from server. Reverting.');
		}
	};

	const isInWatchlist = (movieId: string) =>
		get(store).watchlist.some((movie) => movie.id === movieId);

	const replaceAll = async (movies: Movie[]) => {
		const sanitized = movies.map(sanitizeMovie).filter((movie): movie is Movie => Boolean(movie));

		const deduped = sanitized.reduce<Movie[]>((accumulator, movie) => {
			return accumulator.some((existing) => existing.id === movie.id)
				? accumulator
				: [...accumulator, movie];
		}, []);

		store.update((state) => ({ ...state, watchlist: deduped, error: null }));
		persist(deduped);

		try {
			const response = await fetch('/api/watchlist', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ movies: deduped }),
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Failed to replace watchlist on server');
		} catch (error) {
			console.error('[watchlist][replaceAll] sync failed', error);
			setError('Replaced locally, but failed to sync with server.');
		}
	};

	const clear = async () => {
		store.set({ ...initialState });
		persist([]);

		try {
			const response = await fetch('/api/watchlist', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ clearAll: true }),
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Failed to clear on server');
		} catch (error) {
			console.error('[watchlist][clear] sync failed', error);
			setError('Cleared locally, but failed to sync with server.');
		}
	};

	const exportData = () => structuredClone(get(store).watchlist);

	return {
		subscribe: store.subscribe,
		addToWatchlist,
		removeFromWatchlist,
		isInWatchlist,
		replaceAll,
		clear,
		exportData,
		clearError,
		setError
	};
}

export const watchlist = createWatchlistStore();
