import type { LibraryMedia } from '$lib/types/library';

export interface SearchHistoryItem {
	query: string;
	timestamp: number;
}

const historyStorageKey = 'meatflicks:search-history';

export function getSearchHistory(browser: boolean): string[] {
	if (!browser) return [];
	const stored = localStorage.getItem(historyStorageKey);
	if (!stored) return [];
	try {
		const parsed = JSON.parse(stored) as unknown;
		if (Array.isArray(parsed)) {
			return parsed.filter((value): value is string => typeof value === 'string').slice(0, 8);
		}
	} catch {
		// Do nothing, just return an empty array
	}
	return [];
}

export function addToSearchHistory(term: string, browser: boolean): void {
	const normalized = term.trim();
	if (!normalized) return;
	const currentHistory = getSearchHistory(browser);
	const lowerNormalized = normalized.toLowerCase();
	const next = [
		normalized,
		...currentHistory.filter((item) => item.toLowerCase() !== lowerNormalized)
	].slice(0, 8);
	if (browser) {
		localStorage.setItem(historyStorageKey, JSON.stringify(next));
	}
}

export function clearSearchHistory(browser: boolean): string[] {
	if (browser) {
		localStorage.removeItem(historyStorageKey);
	}
	return [];
}

export type SortOption = 'relevance' | 'rating' | 'newest';

export function sortMovies(items: LibraryMedia[], sortBy: SortOption): LibraryMedia[] {
	const result = [...items];
	if (sortBy === 'rating') {
		result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
	} else if (sortBy === 'newest') {
		const toTimestamp = (value: LibraryMedia['releaseDate']) => {
			if (!value) return 0;
			const date = typeof value === 'string' ? new Date(value) : value;
			return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
		};
		result.sort((a, b) => toTimestamp(b.releaseDate) - toTimestamp(a.releaseDate));
	}
	return result;
}

export type QualityFilter = 'any' | 'hd' | '4k';

export function filterMoviesByQuality(
	items: LibraryMedia[],
	qualityFilter: QualityFilter
): LibraryMedia[] {
	if (qualityFilter === '4k') {
		return items.filter((item) => item.is4K);
	}
	if (qualityFilter === 'hd') {
		return items.filter((item) => item.is4K || item.isHD);
	}
	return items;
}