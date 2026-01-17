import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchHistoryRepository } from '$lib/server/repositories/search-history.repository';
import type { MovieFilters } from '$lib/types/filters';
import { z } from 'zod';
import { validateRequestBody } from '$lib/server/validation';
import { errorHandler, UnauthorizedError } from '$lib/server';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new UnauthorizedError('User must be logged in to view search history');
		}

		const limit = 10;
		const searches = await searchHistoryRepository.getRecentSearches(user.id, limit);
		return json({ searches });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new UnauthorizedError('User must be logged in to save search history');
		}

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

		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new UnauthorizedError('User must be logged in to delete search history');
		}

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

		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
