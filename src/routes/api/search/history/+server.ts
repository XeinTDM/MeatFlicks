import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchHistoryRepository } from '$lib/server/repositories/search-history.repository';
import type { MovieFilters } from '$lib/types/filters';
import { z } from 'zod';
import { validateRequestBody, searchHistorySchema } from '$lib/server/validation';
import { errorHandler } from '$lib/server';

export const GET: RequestHandler = async ({ locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (session && user) {
		try {
			const limit = 10;
			const searches = await searchHistoryRepository.getRecentSearches(user.id, limit);
			return json({ searches });
		} catch (error) {
			console.error('Error fetching search history:', error);
			return json({ error: 'Failed to fetch search history' }, { status: 500 });
		}
	}

	return json({ searches: [] });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (session && user) {
		try {
			const body = await request.json();
			const validatedBody = validateRequestBody(
				z.object({
					query: z.string().min(1, 'Search query is required').max(200, 'Search query too long'),
					filters: z.any().optional()
				}),
				body
			);

			await searchHistoryRepository.addSearch(
				user.id,
				validatedBody.query.trim(),
				validatedBody.filters as MovieFilters | undefined
			);
		} catch (error) {
			const { status, body } = errorHandler.handleError(error);
			return json(body, { status });
		}
	}

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (session && user) {
		try {
			const body = await request.json().catch(() => ({}));
			const validatedBody = validateRequestBody(
				z.object({
					id: z.number().positive().optional()
				}),
				body
			);

			if (validatedBody.id !== undefined) {
				await searchHistoryRepository.deleteSearch(user.id, validatedBody.id);
			} else {
				await searchHistoryRepository.clearHistory(user.id);
			}
		} catch (error) {
			const { status, body } = errorHandler.handleError(error);
			return json(body, { status });
		}
	}

	return json({ success: true });
};
