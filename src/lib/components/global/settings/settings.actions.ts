import { watchlist } from '$lib/state/stores/watchlistStore.svelte';
import { watchHistory } from '$lib/state/stores/historyStore';
import { preferences, DEFAULT_PREFERENCES } from '$lib/state/stores/preferencesStore';
import type { Movie } from '$lib/state/stores/watchlistStore.svelte';
import type { HistoryEntry } from '$lib/state/stores/historyStore';

export type DataNotice = { text: string; tone: 'success' | 'error' };

export const resetPreferencesData = (): DataNotice => {
	preferences.reset();
	return { text: 'Preferences reset to defaults.', tone: 'success' };
};

export const clearWatchlistData = (): DataNotice => {
	watchlist.clear();
	return { text: 'Watchlist cleared.', tone: 'success' };
};

export const clearWatchHistoryData = (): DataNotice => {
	watchHistory.clear();
	return { text: 'Watch history cleared.', tone: 'success' };
};

export const exportUserData = async (): Promise<DataNotice> => {
	try {
		const payload = {
			version: 1,
			generatedAt: new Date().toISOString(),
			watchlist: watchlist.exportData(),
			history: watchHistory.exportData()
		};

		const blob = new Blob([JSON.stringify(payload, null, 2)], {
			type: 'application/json'
		});

		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'meatflicks-data.json';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		return { text: 'Data exported successfully.', tone: 'success' };
	} catch (error) {
		console.error('Failed to export data:', error);
		return { text: 'Failed to export data. Please try again.', tone: 'error' };
	}
};

export const importUserData = async (file: File): Promise<DataNotice> => {
	try {
		const text = await file.text();
		const parsed = JSON.parse(text) as Record<string, unknown>;

		if ('watchlist' in parsed && Array.isArray(parsed.watchlist)) {
			watchlist.replaceAll(parsed.watchlist as Movie[]);
		}

		if ('history' in parsed && Array.isArray(parsed.history)) {
			watchHistory.replaceAll(parsed.history as HistoryEntry[]);
		}

		return { text: 'Data imported successfully.', tone: 'success' };
	} catch (error) {
		console.error('Failed to import data:', error);
		return {
			text: 'Failed to import data. Ensure the file is valid JSON.',
			tone: 'error'
		};
	}
};
