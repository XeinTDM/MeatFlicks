/**
 * URL state management utilities for filters, sorting, and pagination
 */

import type { MovieFilters, SortOptions } from '$lib/types/filters';
import type { PaginationParams } from '$lib/types/pagination';
import { DEFAULT_PAGE_SIZE, MIN_PAGE_SIZE, MAX_PAGE_SIZE } from '$lib/types/pagination';

/**
 * Parse filters from URL search params
 */
export function parseFiltersFromURL(searchParams: URLSearchParams): MovieFilters {
	const filters: MovieFilters = {};

	// Year filters
	const yearFrom = searchParams.get('yearFrom');
	if (yearFrom) {
		const year = parseInt(yearFrom, 10);
		if (!Number.isNaN(year) && year > 1900 && year <= new Date().getFullYear() + 10) {
			filters.yearFrom = year;
		}
	}

	const yearTo = searchParams.get('yearTo');
	if (yearTo) {
		const year = parseInt(yearTo, 10);
		if (!Number.isNaN(year) && year > 1900 && year <= new Date().getFullYear() + 10) {
			filters.yearTo = year;
		}
	}

	// Rating filters
	const minRating = searchParams.get('minRating');
	if (minRating) {
		const rating = parseFloat(minRating);
		if (!Number.isNaN(rating) && rating >= 0 && rating <= 10) {
			filters.minRating = rating;
		}
	}

	const maxRating = searchParams.get('maxRating');
	if (maxRating) {
		const rating = parseFloat(maxRating);
		if (!Number.isNaN(rating) && rating >= 0 && rating <= 10) {
			filters.maxRating = rating;
		}
	}

	// Runtime filters
	const runtimeMin = searchParams.get('runtimeMin');
	if (runtimeMin) {
		const runtime = parseInt(runtimeMin, 10);
		if (!Number.isNaN(runtime) && runtime >= 0) {
			filters.runtimeMin = runtime;
		}
	}

	const runtimeMax = searchParams.get('runtimeMax');
	if (runtimeMax) {
		const runtime = parseInt(runtimeMax, 10);
		if (!Number.isNaN(runtime) && runtime >= 0) {
			filters.runtimeMax = runtime;
		}
	}

	// Language filter
	const language = searchParams.get('language');
	if (language && language.trim()) {
		filters.language = language.trim();
	}

	// Genre filters
	const genres = searchParams.get('genres');
	if (genres) {
		filters.genres = genres
			.split(',')
			.filter(Boolean)
			.map((g) => g.trim());
	}

	const genreMode = searchParams.get('genreMode');
	if (genreMode === 'AND' || genreMode === 'OR') {
		filters.genreMode = genreMode;
	}

	// Media type filter
	const mediaType = searchParams.get('mediaType');
	if (mediaType === 'movie' || mediaType === 'tv' || mediaType === 'all') {
		filters.mediaType = mediaType;
	}

	return filters;
}

/**
 * Serialize filters to URL search params
 */
export function serializeFiltersToURL(filters: MovieFilters): URLSearchParams {
	const params = new URLSearchParams();

	if (filters.yearFrom) {
		params.set('yearFrom', String(filters.yearFrom));
	}
	if (filters.yearTo) {
		params.set('yearTo', String(filters.yearTo));
	}
	if (filters.minRating !== undefined) {
		params.set('minRating', String(filters.minRating));
	}
	if (filters.maxRating !== undefined) {
		params.set('maxRating', String(filters.maxRating));
	}
	if (filters.runtimeMin !== undefined) {
		params.set('runtimeMin', String(filters.runtimeMin));
	}
	if (filters.runtimeMax !== undefined) {
		params.set('runtimeMax', String(filters.runtimeMax));
	}
	if (filters.language) {
		params.set('language', filters.language);
	}
	if (filters.genres && filters.genres.length > 0) {
		params.set('genres', filters.genres.join(','));
	}
	if (filters.genreMode && filters.genreMode !== 'OR') {
		params.set('genreMode', filters.genreMode);
	}
	if (filters.mediaType && filters.mediaType !== 'all') {
		params.set('mediaType', filters.mediaType);
	}

	return params;
}

/**
 * Parse sort options from URL search params
 */
export function parseSortFromURL(searchParams: URLSearchParams): SortOptions {
	const field = searchParams.get('sort') || 'popularity';
	const order = searchParams.get('order') || 'desc';

	const validFields: SortOptions['field'][] = [
		'popularity',
		'rating',
		'releaseDate',
		'title',
		'runtime'
	];
	const validOrder: SortOptions['order'][] = ['asc', 'desc'];

	return {
		field: validFields.includes(field as SortOptions['field'])
			? (field as SortOptions['field'])
			: 'popularity',
		order: validOrder.includes(order as SortOptions['order'])
			? (order as SortOptions['order'])
			: 'desc'
	};
}

/**
 * Serialize sort options to URL search params
 */
export function serializeSortToURL(sort: SortOptions): URLSearchParams {
	const params = new URLSearchParams();
	if (sort.field !== 'popularity') {
		params.set('sort', sort.field);
	}
	if (sort.order !== 'desc') {
		params.set('order', sort.order);
	}
	return params;
}

/**
 * Parse pagination params from URL search params
 */
export function parsePaginationFromURL(searchParams: URLSearchParams): PaginationParams {
	const page = parseInt(searchParams.get('page') || '1', 10);
	const pageSize = parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10);

	return {
		page: Math.max(1, page),
		pageSize: Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, pageSize))
	};
}

/**
 * Serialize pagination params to URL search params
 */
export function serializePaginationToURL(pagination: PaginationParams): URLSearchParams {
	const params = new URLSearchParams();
	if (pagination.page > 1) {
		params.set('page', String(pagination.page));
	}
	if (pagination.pageSize !== DEFAULT_PAGE_SIZE) {
		params.set('pageSize', String(pagination.pageSize));
	}
	return params;
}

/**
 * Combine all URL params (filters, sort, pagination) into a single URLSearchParams
 */
export function combineURLParams(
	filters: MovieFilters,
	sort: SortOptions,
	pagination: PaginationParams
): URLSearchParams {
	const params = new URLSearchParams();

	// Add filters
	const filterParams = serializeFiltersToURL(filters);
	filterParams.forEach((value, key) => {
		params.set(key, value);
	});

	// Add sort
	const sortParams = serializeSortToURL(sort);
	sortParams.forEach((value, key) => {
		params.set(key, value);
	});

	// Add pagination
	const paginationParams = serializePaginationToURL(pagination);
	paginationParams.forEach((value, key) => {
		params.set(key, value);
	});

	return params;
}

/**
 * Parse all params (filters, sort, pagination) from URL search params
 */
export function parseAllFromURL(searchParams: URLSearchParams): {
	filters: MovieFilters;
	sort: SortOptions;
	pagination: PaginationParams;
} {
	return {
		filters: parseFiltersFromURL(searchParams),
		sort: parseSortFromURL(searchParams),
		pagination: parsePaginationFromURL(searchParams)
	};
}
