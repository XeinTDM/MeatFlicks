import { writable, type Writable } from 'svelte/store';

export type PlaybackQuality = 'auto' | 'high' | 'medium' | 'low';

export type AppPreferences = {
	autoplayNext: boolean;
	autoplayTrailers: boolean;
	limitCellularData: boolean;
	emailUpdates: boolean;
	pushReminders: boolean;
	showBackdropAnimations: boolean;
	emphasizeAccessibility: boolean;
	showEpisodeBadges: boolean;
	compactSidebar: boolean;
	playbackQuality: PlaybackQuality;
	skipIntros: boolean;
	rememberPlaybackPosition: boolean;
	adaptiveAudio: boolean;
	wifiOnlyDownloads: boolean;
	autoDownloadNewEpisodes: boolean;
	autoDeleteFinishedDownloads: boolean;
	backgroundRefresh: boolean;
	weeklyDigest: boolean;
	watchlistAlerts: boolean;
	productAnnouncements: boolean;
	focusCollections: boolean;
	hideSpoilers: boolean;
	cinematicPlayback: boolean;
	reduceBuffering: boolean;
	releaseReminders: boolean;
	betaAnnouncements: boolean;
	limitDownloadSize: boolean;
	autoManageDownloads: boolean;
	autoSyncWatchlist: boolean;
};

export const DEFAULT_PREFERENCES: AppPreferences = {
	autoplayNext: true,
	autoplayTrailers: false,
	limitCellularData: true,
	emailUpdates: true,
	pushReminders: false,
	showBackdropAnimations: true,
	emphasizeAccessibility: false,
	showEpisodeBadges: true,
	compactSidebar: false,
	playbackQuality: 'auto',
	skipIntros: true,
	rememberPlaybackPosition: true,
	adaptiveAudio: false,
	wifiOnlyDownloads: true,
	autoDownloadNewEpisodes: false,
	autoDeleteFinishedDownloads: false,
	backgroundRefresh: true,
	weeklyDigest: false,
	watchlistAlerts: true,
	productAnnouncements: false,
	focusCollections: true,
	hideSpoilers: false,
	cinematicPlayback: false,
	reduceBuffering: true,
	releaseReminders: true,
	betaAnnouncements: false,
	limitDownloadSize: true,
	autoManageDownloads: false,
	autoSyncWatchlist: true
};

const STORAGE_KEY = 'meatflicks.preferences';
const isBrowser = typeof window !== 'undefined';

const readPreferences = (): AppPreferences | null => {
	if (!isBrowser) return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		const merged = { ...DEFAULT_PREFERENCES, ...(parsed ?? {}) } satisfies Partial<AppPreferences>;
		return merged as AppPreferences;
	} catch (error) {
		console.error('[preferences][read] failed to read persisted preferences', error);
		return null;
	}
};

function createPreferencesStore() {
	const initial = readPreferences() ?? DEFAULT_PREFERENCES;
	const store = writable<AppPreferences>(initial);

	if (isBrowser) {
		store.subscribe((value) => {
			try {
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
			} catch (error) {
				console.error('[preferences][persist] failed to write preferences', error);
			}
		});
	}

	return {
		subscribe: store.subscribe,
		setPreference<K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) {
			store.update((current) => ({ ...current, [key]: value }));
		},
		reset() {
			store.set(DEFAULT_PREFERENCES);
			if (isBrowser) {
				window.localStorage.removeItem(STORAGE_KEY);
			}
		},
		getSnapshot: () => {
			let snapshot: AppPreferences = DEFAULT_PREFERENCES;
			store.subscribe((value) => {
				snapshot = value;
			})();
			return snapshot;
		}
	} satisfies {
		subscribe: Writable<AppPreferences>['subscribe'];
		setPreference: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
		reset: () => void;
		getSnapshot: () => AppPreferences;
	};
}

export const preferences = createPreferencesStore();
