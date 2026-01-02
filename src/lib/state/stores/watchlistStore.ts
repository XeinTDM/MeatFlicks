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

const STORAGE_KEY = 'meatflicks.watchlist';
const hasStorage = typeof localStorage !== 'undefined';

const normalizeDateString = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) return null;
	return new Date(parsed).toISOString();
};

const buildCanonicalPath = (
	payload: Partial<Movie> & Record<string, unknown>,
	id: string
): string => {
	const fromPayload = typeof payload.canonicalPath === 'string' ? payload.canonicalPath.trim() : '';
	if (fromPayload) return fromPayload.startsWith('/') ? fromPayload : `/${fromPayload}`;

	const imdbId = typeof payload.imdbId === 'string' ? payload.imdbId.trim() : '';
	if (imdbId) return `/movie/${imdbId}`;

	const tmdbId = typeof payload.tmdbId === 'number' && Number.isFinite(payload.tmdbId) ? payload.tmdbId : null;
	if (tmdbId) return `/movie/${tmdbId}`;

	return `/movie/${id}`;
};

const sanitizeMovie = (candidate: unknown): Movie | null => {
	if (!candidate || typeof candidate !== 'object') return null;
	const payload = candidate as Partial<Movie> & Record<string, unknown>;
	const id = typeof payload.id === 'string' ? payload.id : String(payload.id ?? '');
	const title = typeof payload.title === 'string' ? payload.title : String(payload.title ?? '');

	if (!id) return null;

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
	};
};

const readStorage = (): Movie[] => {
	if (!hasStorage) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		return parsed
			.map(sanitizeMovie)
			.filter((movie): movie is Movie => Boolean(movie))
			.reduce<Movie[]>((accumulator, movie) => {
				return accumulator.some((existing) => existing.id === movie.id)
					? accumulator
					: [...accumulator, movie];
			}, []);
	} catch (error) {
		console.error('[watchlist][readStorage] Failed', error);
		return [];
	}
};

const persist = (items: Movie[]) => {
	if (!hasStorage) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	} catch (error) {
		console.error('[watchlist][persist] Failed', error);
	}
};

class WatchlistStore {
	#watchlist = $state<Movie[]>([]);
	#loading = $state(false);
	#error = $state<string | null>(null);

	constructor() {
		if (typeof window !== 'undefined') {
			this.#watchlist = readStorage();
			this.syncFromServer();

			window.addEventListener('storage', (event) => {
				if (event.key === STORAGE_KEY) {
					this.#watchlist = readStorage();
				}
			});

			window.addEventListener('online', () => {
				this.syncFromServer();
			});
		}
	}

	get items() { return this.#watchlist; }
	get loading() { return this.#loading; }
	get error() { return this.#error; }

	async syncFromServer() {
		if (typeof window === 'undefined') return;

		this.#loading = true;
		try {
			const response = await fetch('/api/watchlist', { credentials: 'include' });
			if (response.ok) {
				const serverMovies = await response.json();
				const sanitized = serverMovies
					.map(sanitizeMovie)
					.filter((movie: Movie | null): movie is Movie => Boolean(movie));

				if (sanitized.length > 0) {
					this.#watchlist = sanitized;
					persist(sanitized);
				}
			}
		} catch (error) {
			console.error('[watchlist][syncFromServer] Failed', error);
		} finally {
			this.#loading = false;
		}
	}

	isInWatchlist(movieId: string): boolean {
		return this.#watchlist.some((movie) => movie.id === movieId);
	}

	async addToWatchlist(movie: WatchlistCandidate) {
		const sanitized = sanitizeMovie(movie);
		if (!sanitized) {
			this.#error = 'Missing movie data';
			return;
		}

		const previousWatchlist = [...this.#watchlist];
		const existingIndex = this.#watchlist.findIndex((item) => item.id === sanitized.id);

		if (existingIndex >= 0) {
			this.#watchlist[existingIndex] = { ...sanitized, addedAt: this.#watchlist[existingIndex].addedAt };
		} else {
			this.#watchlist.push(sanitized);
		}

		persist(this.#watchlist);

		try {
			const response = await fetch('/api/watchlist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ movie: sanitized }),
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Failed to sync');

			if (existingIndex < 0) {
				notifications.movieAdded({
					title: sanitized.title,
					posterPath: sanitized.posterPath,
					tmdbId: sanitized.tmdbId ?? 0
				});
			}
		} catch (error) {
			this.#watchlist = previousWatchlist;
			persist(this.#watchlist);
			notifications.error('Sync Error', 'Failed to save to server.');
		}
	}

	async removeFromWatchlist(movieId: string) {
		const previousWatchlist = [...this.#watchlist];
		const movieTitle = this.#watchlist.find((m) => m.id === movieId)?.title ?? 'Movie';

		this.#watchlist = this.#watchlist.filter((m) => m.id !== movieId);
		persist(this.#watchlist);

		try {
			const response = await fetch('/api/watchlist', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ movieId }),
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Failed to sync');
			notifications.info('Removed', `Removed "${movieTitle}" from watchlist.`);
		} catch (error) {
			this.#watchlist = previousWatchlist;
			persist(this.#watchlist);
			notifications.error('Sync Error', 'Failed to remove from server.');
		}
	}

	async clear() {
		this.#watchlist = [];
		persist([]);
		try {
			await fetch('/api/watchlist', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ clearAll: true }),
				credentials: 'include'
			});
		} catch (error) {
			console.error('[watchlist][clear] Sync failed', error);
		}
	}

	async replaceAll(movies: Movie[]) {
		const sanitized = movies.map(sanitizeMovie).filter((movie): movie is Movie => Boolean(movie));
		this.#watchlist = sanitized;
		persist(sanitized);
		try {
			await fetch('/api/watchlist', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ movies: sanitized }),
				credentials: 'include'
			});
		} catch (error) {
			console.error('[watchlist][replaceAll] Sync failed', error);
		}
	}

	exportData() {
		return $state.snapshot(this.#watchlist);
	}
}

export const watchlist = new WatchlistStore();
