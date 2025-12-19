/**
 * Advanced filtering types for content discovery
 */

export interface MovieFilters {
    /** Filter by release year (from) */
    yearFrom?: number;
    /** Filter by release year (to) */
    yearTo?: number;
    /** Minimum rating (0-10) */
    minRating?: number;
    /** Maximum rating (0-10) */
    maxRating?: number;
    /** Minimum runtime in minutes */
    runtimeMin?: number;
    /** Maximum runtime in minutes */
    runtimeMax?: number;
    /** Original language code (e.g., 'en', 'es', 'ja') */
    language?: string;
    /** Genre IDs or names to filter by */
    genres?: string[];
    /** How to combine multiple genres: AND (all) or OR (any) */
    genreMode?: 'AND' | 'OR';
    /** Media type filter */
    mediaType?: 'movie' | 'tv' | 'all';
}

export interface SortOptions {
    /** Field to sort by */
    field: 'popularity' | 'rating' | 'releaseDate' | 'title' | 'runtime';
    /** Sort order */
    order: 'asc' | 'desc';
}

export type SortField = SortOptions['field'];
export type SortOrder = SortOptions['order'];

/**
 * Preset runtime ranges for quick filtering
 */
export const RUNTIME_PRESETS = {
    short: { min: 0, max: 90, label: 'Short (< 90 min)' },
    medium: { min: 90, max: 150, label: 'Medium (90-150 min)' },
    long: { min: 150, max: 999, label: 'Long (> 150 min)' }
} as const;

export type RuntimePreset = keyof typeof RUNTIME_PRESETS;

/**
 * Common language options
 */
export const LANGUAGE_OPTIONS = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ar', name: 'Arabic' }
] as const;

/**
 * Helper to check if filters are active
 */
export function hasActiveFilters(filters: MovieFilters): boolean {
    return !!(
        filters.yearFrom ||
        filters.yearTo ||
        filters.minRating ||
        filters.maxRating ||
        filters.runtimeMin ||
        filters.runtimeMax ||
        filters.language ||
        (filters.genres && filters.genres.length > 0)
    );
}

/**
 * Helper to count active filters
 */
export function countActiveFilters(filters: MovieFilters): number {
    let count = 0;
    if (filters.yearFrom || filters.yearTo) count++;
    if (filters.minRating || filters.maxRating) count++;
    if (filters.runtimeMin || filters.runtimeMax) count++;
    if (filters.language) count++;
    if (filters.genres && filters.genres.length > 0) count++;
    return count;
}

/**
 * Helper to create filter description
 */
export function getFilterDescription(filters: MovieFilters): string {
    const parts: string[] = [];

    if (filters.yearFrom || filters.yearTo) {
        if (filters.yearFrom && filters.yearTo) {
            parts.push(`${filters.yearFrom}-${filters.yearTo}`);
        } else if (filters.yearFrom) {
            parts.push(`From ${filters.yearFrom}`);
        } else if (filters.yearTo) {
            parts.push(`Until ${filters.yearTo}`);
        }
    }

    if (filters.minRating) {
        parts.push(`Rating ≥ ${filters.minRating}`);
    }

    if (filters.runtimeMin || filters.runtimeMax) {
        if (filters.runtimeMin && filters.runtimeMax) {
            parts.push(`${filters.runtimeMin}-${filters.runtimeMax} min`);
        } else if (filters.runtimeMin) {
            parts.push(`≥ ${filters.runtimeMin} min`);
        } else if (filters.runtimeMax) {
            parts.push(`≤ ${filters.runtimeMax} min`);
        }
    }

    if (filters.language) {
        const lang = LANGUAGE_OPTIONS.find((l) => l.code === filters.language);
        if (lang) parts.push(lang.name);
    }

    if (filters.genres && filters.genres.length > 0) {
        parts.push(`${filters.genres.length} genre${filters.genres.length > 1 ? 's' : ''}`);
    }

    return parts.join(' • ');
}
