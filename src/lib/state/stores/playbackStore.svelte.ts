import type { LibraryMedia } from '$lib/types/library';

export type PlaybackProgress = {
	mediaId: string;
	mediaType: 'movie' | 'tv' | 'anime';
	progress: number;
	duration: number;
	seasonNumber?: number;
	episodeNumber?: number;
	updatedAt: number;
	mediaData?: LibraryMedia;
};

const STORAGE_KEY = 'meatflicks.playback_progress';
const hasStorage = typeof localStorage !== 'undefined';

export function shouldShowInContinueWatching(p: PlaybackProgress): boolean {
	if (!p.duration || p.duration <= 0) return false;

	const percent = (p.progress / p.duration) * 100;
	if (percent >= 95) return false;

	const isShortContent = p.duration < 20 * 60;

	if (isShortContent) {
		return p.progress >= 20;
	}

	if (p.mediaType === 'movie') {
		return p.progress >= 120;
	}

	return p.progress >= 60;
}

function readStorage(): Record<string, PlaybackProgress> {
	if (!hasStorage) return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch (error) {
		console.error('[playbackStore] Failed to read storage:', error);
		return {};
	}
}

function persist(data: Record<string, PlaybackProgress>) {
	if (!hasStorage) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch (error) {
		console.error('[playbackStore] Failed to persist data:', error);
	}
}

export class PlaybackStore {
	progress = $state<Record<string, PlaybackProgress>>(hasStorage ? readStorage() : {});

	saveProgress = (p: PlaybackProgress) => {
		const key = `${p.mediaType}:${p.mediaId}${
			p.mediaType !== 'movie' ? `:s${p.seasonNumber}e${p.episodeNumber}` : ''
		}`;
		this.progress[key] = { ...p, updatedAt: Date.now() };
		persist(this.progress);
	};

	getProgress = (
		mediaId: string,
		mediaType: 'movie' | 'tv' | 'anime',
		season?: number,
		episode?: number
	) => {
		const key = `${mediaType}:${mediaId}${mediaType !== 'movie' ? `:s${season}e${episode}` : ''}`;
		return this.progress[key] || null;
	};

	getContinueWatching = () => {
		return Object.values(this.progress)
			.filter((p) => {
				return shouldShowInContinueWatching(p);
			})
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.map((p) => ({
				...p.mediaData,
				progressPercent: (p.progress / p.duration) * 100,
				progressSeconds: p.progress,
				durationSeconds: p.duration,
				seasonNumber: p.seasonNumber,
				episodeNumber: p.episodeNumber
			}))
			.filter((m) => !!m) as LibraryMedia[];
	};
}

export const playbackStore = new PlaybackStore();
