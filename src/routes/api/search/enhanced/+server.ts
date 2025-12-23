import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { validateQueryParams } from '$lib/server/validation';
import { errorHandler } from '$lib/server';
import { enhancedSearch, autocompleteSearch } from '$lib/server/services/enhanced-search.service';

const searchOptionsSchema = z.object({
	q: z.string().optional(),
	limit: z.coerce.number().int().positive().max(100).default(20).optional(),
	offset: z.coerce.number().int().nonnegative().default(0).optional(),
	genres: z.string().transform(val => val.split(',').filter(Boolean)).optional(),
	minRating: z.coerce.number().min(0).max(10).optional(),
	maxRating: z.coerce.number().min(0).max(10).optional(),
	minYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
	maxYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
	sortBy: z.enum(['relevance', 'rating', 'releaseDate', 'title']).default('relevance').optional(),
	sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
	includeAdult: z.coerce.boolean().default(false).optional()
});

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Validate query parameters
		const queryParams = validateQueryParams(searchOptionsSchema, url.searchParams);

		// Perform enhanced search
		const result = await enhancedSearch({
			query: queryParams.q,
			limit: queryParams.limit,
			offset: queryParams.offset,
			genres: queryParams.genres,
			minRating: queryParams.minRating,
			maxRating: queryParams.maxRating,
			minYear: queryParams.minYear,
			maxYear: queryParams.maxYear,
			sortBy: queryParams.sortBy,
			sortOrder: queryParams.sortOrder,
			includeAdult: queryParams.includeAdult
		});

		return json({
			success: true,
			...result
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

const autocompleteSchema = z.object({
	q: z.string().min(2, 'Query must be at least 2 characters')
});

export const GET_AUTOCOMPLETE: RequestHandler = async ({ url }) => {
	try {
		// Validate query parameters
		const queryParams = validateQueryParams(autocompleteSchema, url.searchParams);

		// Perform autocomplete search
		const result = await autocompleteSearch(queryParams.q);

		return json({
			success: true,
			...result
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
