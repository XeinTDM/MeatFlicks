import { page } from '$app/state';
import type { Media } from './watchlistStore.svelte';

export type HistoryEntry = Omit<Media, 'addedAt'> & {
	watchedAt: string;
	mediaType?: string;
	season?: number;
	episode?: number;
};

const STORAGE_KEY = 'meatflicks.history';
const hasStorage = typeof localStorage !== 'undefined';

const resolveCanonicalPath = (
	payload: Partial<Media> & Record<string, unknown>,
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
		typeof payload.watchedAt === 'string' ? payload.watchedAt : String(payload.watchedAt ?? new Date().toISOString());

	if (!id) {
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

class HistoryStore {
	#entries = $state<HistoryEntry[]>([]);
	#loading = $state(false);
	#error = $state<string | null>(null);

	constructor() {
		if (typeof window !== 'undefined') {
			this.#entries = readStorage();
			this.syncFromServer();

			window.addEventListener('storage', (event) => {
				if (event.key === STORAGE_KEY) {
					this.#entries = readStorage();
				}
			});

			window.addEventListener('online', () => {
				this.syncFromServer();
			});
		}
	}

	get entries() { return this.#entries; }
	get loading() { return this.#loading; }
	get error() { return this.#error; }

	async syncFromServer() {
		if (typeof window === 'undefined') return;
		if (!page.data.user) return;

		this.#loading = true;
		try {
			const response = await fetch('/api/history', { credentials: 'include' });
			if (response.ok) {
				const serverHistory = await response.json();
				const sanitized = serverHistory
					.map(sanitizeEntry)
					.filter((entry: HistoryEntry | null): entry is HistoryEntry => Boolean(entry));

				if (sanitized.length > 0) {
					this.#entries = sanitized;
					persist(sanitized);
				}
			}
		} catch (error) {
			console.error('[history][syncFromServer] Failed', error);
		} finally {
			this.#loading = false;
		}
	}

	async recordWatch(media: Partial<Media> & Record<string, unknown>) {
		const id = typeof media.id === 'string' ? media.id : String(media.id ?? '');
		if (!id) return;

		const timestamp = new Date().toISOString();
		const entry = sanitizeEntry({ ...media, watchedAt: timestamp });

		if (!entry) return;

		// Optimistic update
		this.#entries = [entry, ...this.#entries.filter(e => e.id !== entry.id)].sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1));
		persist(this.#entries);

		if (!page.data.user) return;

		try {
			const response = await fetch('/api/history', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mediaId: entry.id }),
				credentials: 'include'
			});

			if (!response.ok) throw new Error('Failed to sync');
		} catch (error) {
			console.error('[history][recordWatch] Sync failed', error);
		}
	}

	async remove(mediaId: string) {
		this.#entries = this.#entries.filter((entry) => entry.id !== mediaId);
		persist(this.#entries);
	}

	async clear() {
		this.#entries = [];
		persist([]);

		if (!page.data.user) return;

		try {
			await fetch('/api/history', { method: 'DELETE', credentials: 'include' });
		} catch (error) {
			console.error('[history][clear] Sync failed', error);
		}
	}

	exportData() {
		return $state.snapshot(this.#entries);
	}

	replaceAll(entries: HistoryEntry[]) {
		const sanitized = entries
			.map(sanitizeEntry)
			.filter((entry): entry is HistoryEntry => Boolean(entry))
			.sort((a, b) => (a.watchedAt > b.watchedAt ? -1 : 1));

		this.#entries = sanitized;
		persist(sanitized);
	}
}

export const watchHistory = new HistoryStore();
