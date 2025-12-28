import type { LibraryMovie } from '$lib/types/library';

export type PlaybackProgress = {
    mediaId: string;
    mediaType: 'movie' | 'tv';
    progress: number;
    duration: number;
    seasonNumber?: number;
    episodeNumber?: number;
    updatedAt: number;
    movieData?: LibraryMovie;
};

const STORAGE_KEY = 'meatflicks.playback_progress';
const hasStorage = typeof localStorage !== 'undefined';

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
        const key = `${p.mediaType}:${p.mediaId}${p.mediaType === 'tv' ? `:s${p.seasonNumber}e${p.episodeNumber}` : ''
            }`;
        this.progress[key] = { ...p, updatedAt: Date.now() };
        persist(this.progress);
    };

    getProgress = (
        mediaId: string,
        mediaType: 'movie' | 'tv',
        season?: number,
        episode?: number
    ) => {
        const key = `${mediaType}:${mediaId}${mediaType === 'tv' ? `:s${season}e${episode}` : ''
            }`;
        return this.progress[key] || null;
    };

    getContinueWatching = () => {
        return Object.values(this.progress)
            .filter((p) => {
                const percent = (p.progress / p.duration) * 100;
                return percent > 1 && percent < 90;
            })
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((p) => ({
                ...p.movieData,
                progressPercent: (p.progress / p.duration) * 100,
                progressSeconds: p.progress,
                durationSeconds: p.duration,
                seasonNumber: p.seasonNumber,
                episodeNumber: p.episodeNumber
            }))
            .filter((m) => !!m) as LibraryMovie[];
    };
}

export const playbackStore = new PlaybackStore();
