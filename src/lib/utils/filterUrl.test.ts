import { describe, it, expect } from 'vitest';
import {
	parseFiltersFromURL,
	serializeFiltersToURL,
	parseSortFromURL,
	serializeSortToURL,
	parsePaginationFromURL,
	serializePaginationToURL,
	parseAllFromURL,
	combineURLParams
} from './filterUrl';

describe('filterUrl utils', () => {
	describe('parseFiltersFromURL', () => {
		it('should parse valid filters from search params', () => {
			const params = new URLSearchParams(
				'yearFrom=2000&yearTo=2020&minRating=7.5&maxRating=9&runtimeMin=90&runtimeMax=180&language=en&genres=action,drama&genreMode=AND&mediaType=movie'
			);
			const filters = parseFiltersFromURL(params);

			expect(filters).toEqual({
				yearFrom: 2000,
				yearTo: 2020,
				minRating: 7.5,
				maxRating: 9,
				runtimeMin: 90,
				runtimeMax: 180,
				language: 'en',
				genres: ['action', 'drama'],
				genreMode: 'AND',
				mediaType: 'movie'
			});
		});

		it('should ignore invalid filter values', () => {
			const params = new URLSearchParams('yearFrom=abc&minRating=11&runtimeMin=-5');
			const filters = parseFiltersFromURL(params);
			expect(filters).toEqual({});
		});
	});

	describe('serializeFiltersToURL', () => {
		it('should serialize filters to search params', () => {
			const filters = {
				yearFrom: 2000,
				genres: ['action', 'drama'],
				mediaType: 'movie' as const
			};
			const params = serializeFiltersToURL(filters);

			expect(params.get('yearFrom')).toBe('2000');
			expect(params.get('genres')).toBe('action,drama');
			expect(params.get('mediaType')).toBe('movie');
		});

		it('should not serialize default or empty values', () => {
			const filters = { mediaType: 'all' as const, genres: [] };
			const params = serializeFiltersToURL(filters);
			expect(params.toString()).toBe('');
		});
	});

	describe('parseSortFromURL', () => {
		it('should parse valid sort options', () => {
			const params = new URLSearchParams('sort=releaseDate&order=asc');
			const sort = parseSortFromURL(params);
			expect(sort).toEqual({ field: 'releaseDate', order: 'asc' });
		});

		it('should return defaults for missing or invalid options', () => {
			const params = new URLSearchParams('sort=invalid&order=invalid');
			const sort = parseSortFromURL(params);
			expect(sort).toEqual({ field: 'popularity', order: 'desc' });
		});
	});

	describe('parsePaginationFromURL', () => {
		it('should parse valid pagination', () => {
			const params = new URLSearchParams('page=2&pageSize=40');
			const pagination = parsePaginationFromURL(params);
			expect(pagination).toEqual({ page: 2, pageSize: 40 });
		});

		it('should handle invalid pagination values', () => {
			const params = new URLSearchParams('page=0&pageSize=1000');
			const pagination = parsePaginationFromURL(params);
			expect(pagination.page).toBe(1);
			expect(pagination.pageSize).toBeLessThan(1000);
		});
	});

	describe('combineURLParams', () => {
		it('should combine all params correctly', () => {
			const filters = { yearFrom: 2020 };
			const sort = { field: 'title' as const, order: 'asc' as const };
			const pagination = { page: 3, pageSize: 20 };
			const params = combineURLParams(filters, sort, pagination, 'only');

			expect(params.get('yearFrom')).toBe('2020');
			expect(params.get('sort')).toBe('title');
			expect(params.get('order')).toBe('asc');
			expect(params.get('page')).toBe('3');
			expect(params.get('include_anime')).toBe('only');
		});
	});
});
