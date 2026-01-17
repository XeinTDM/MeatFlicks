import type { LibraryMedia } from '$lib/types/library';
import { notifications } from './notificationStore';
import { page } from '$app/state';

export type Media = {
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

// Compatibility alias
export type Movie = Media;

type WatchlistCandidate = LibraryMedia | Media | (Partial<Media> & Record<string, unknown>);

const STORAGE_KEY = 'meatflicks.watchlist';
const hasStorage = typeof localStorage !== 'undefined';

const buildJsonHeadersWithCsrf = () => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (page.data.csrfToken) {
		headers['X-CSRF-Token'] = page.data.csrfToken;
	}
	return headers;
};

const normalizeDateString = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) return null;
	return new Date(parsed).toISOString();
};

const buildCanonicalPath = (
	payload: Partial<Media> & Record<string, unknown>,
	id: string
): string => {
	const fromPayload = typeof payload.canonicalPath === 'string' ? payload.canonicalPath.trim() : '';
	if (fromPayload) return fromPayload.startsWith('/') ? fromPayload : `/${fromPayload}`;

	const type = payload.mediaType || payload.media_type || 'movie';
	const prefix = type === 'tv' ? '/tv/' : '/movie/';

	const imdbId = typeof payload.imdbId === 'string' ? payload.imdbId.trim() : '';
	if (imdbId) return `${prefix}${imdbId}`;

	const tmdbId =
		typeof payload.tmdbId === 'number' && Number.isFinite(payload.tmdbId) ? payload.tmdbId : null;
	if (tmdbId) return `${prefix}${tmdbId}`;

	return `${prefix}${id}`;
};

const sanitizeMedia = (candidate: unknown): Media | null => {
	if (!candidate || typeof candidate !== 'object') return null;
	const payload = candidate as Partial<Media> & Record<string, unknown>;
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

const readStorage = (): Media[] => {
	if (!hasStorage) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		return parsed
			.map(sanitizeMedia)
			.filter((m): m is Media => Boolean(m))
			.reduce<Media[]>((accumulator, m) => {
				return accumulator.some((existing) => existing.id === m.id)
					? accumulator
					: [...accumulator, m];
			}, []);
	} catch (error) {
		console.error('[watchlist][readStorage] Failed', error);
		return [];
	}
};

const persist = (items: Media[]) => {
	if (!hasStorage) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	} catch (error) {
		console.error('[watchlist][persist] Failed', error);
	}
};

class WatchlistStore {
	#watchlist = $state<Media[]>([]);
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

	get items() {
		return this.#watchlist;
	}
	get loading() {
		return this.#loading;
	}
	get error() {
		return this.#error;
	}

	async syncFromServer() {
		if (typeof window === 'undefined') return;
		if (!page.data.user) return;

		this.#loading = true;
		try {
			const response = await fetch('/api/watchlist', { credentials: 'include' });
			if (response.ok) {
				const serverMedia = await response.json();
				const sanitized = serverMedia
					.map(sanitizeMedia)
					.filter((m: Media | null): m is Media => Boolean(m));

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

	isInWatchlist(mediaId: string): boolean {
		return this.#watchlist.some((m) => m.id === mediaId);
	}

	async addToWatchlist(mediaItem: WatchlistCandidate) {
		const sanitized = sanitizeMedia(mediaItem);
		if (!sanitized) {
			this.#error = 'Missing media data';
			return;
		}

		const previousWatchlist = [...this.#watchlist];
		const existingIndex = this.#watchlist.findIndex((item) => item.id === sanitized.id);

		if (existingIndex >= 0) {
			this.#watchlist[existingIndex] = {
				...sanitized,
				addedAt: this.#watchlist[existingIndex].addedAt
			};
		} else {
			this.#watchlist.push(sanitized);
		}

		persist(this.#watchlist);

		if (!page.data.user) {
			if (existingIndex < 0) {
				notifications.mediaAdded({
					title: sanitized.title,
					posterPath: sanitized.posterPath,
					tmdbId: sanitized.tmdbId ?? 0
				});
			}
			return;
		}

		try {
			const response = await fetch('/api/watchlist', {
				method: 'POST',
				headers: buildJsonHeadersWithCsrf(),
				body: JSON.stringify({ mediaId: sanitized.id }),
				credentials: 'include'
			});

			if (!response.ok) throw new Error('Failed to sync');

			if (existingIndex < 0) {
				notifications.mediaAdded({
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

	async removeFromWatchlist(mediaId: string) {
		const previousWatchlist = [...this.#watchlist];
		const title = this.#watchlist.find((m) => m.id === mediaId)?.title ?? 'Item';

		this.#watchlist = this.#watchlist.filter((m) => m.id !== mediaId);
		persist(this.#watchlist);

		if (!page.data.user) {
			notifications.info('Removed', `Removed "${title}" from watchlist.`);
			return;
		}

		try {
			const response = await fetch('/api/watchlist', {
				method: 'DELETE',
				headers: buildJsonHeadersWithCsrf(),
				body: JSON.stringify({ mediaId }),
				credentials: 'include'
			});

			if (!response.ok) throw new Error('Failed to sync');
			notifications.info('Removed', `Removed "${title}" from watchlist.`);
		} catch (error) {
			this.#watchlist = previousWatchlist;
			persist(this.#watchlist);
			notifications.error('Sync Error', 'Failed to remove from server.');
		}
	}

	async clear() {
		this.#watchlist = [];
		persist([]);

		if (!page.data.user) return;

		try {
			await fetch('/api/watchlist', {
				method: 'DELETE',
				headers: buildJsonHeadersWithCsrf(),
				body: JSON.stringify({ clearAll: true }),
				credentials: 'include'
			});
		} catch (error) {
			console.error('[watchlist][clear] Sync failed', error);
		}
	}

	exportData() {
		return $state.snapshot(this.#watchlist);
	}

	replaceAll(items: Media[]) {
		const sanitized = items
			.map(sanitizeMedia)
			.filter((m): m is Media => Boolean(m))
			.reduce<Media[]>((accumulator, m) => {
				return accumulator.some((existing) => existing.id === m.id)
					? accumulator
					: [...accumulator, m];
			}, []);

		this.#watchlist = sanitized;
		persist(sanitized);
	}
}

export const watchlist = new WatchlistStore();
