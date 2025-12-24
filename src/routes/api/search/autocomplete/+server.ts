import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { validateQueryParams } from '$lib/server/validation';
import { errorHandler } from '$lib/server';
import { autocompleteSearch } from '$lib/server/services/search.service';

const autocompleteSchema = z.object({
	q: z.string().min(2, 'Query must be at least 2 characters')
});

export const GET: RequestHandler = async ({ url }) => {
	try {
		const queryParams = validateQueryParams(autocompleteSchema, url.searchParams);
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
