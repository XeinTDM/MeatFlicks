import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { watchlistRepository } from '$lib/server/repositories/watchlist.repository';
import { z } from 'zod';
import { errorHandler, ValidationError } from '$lib/server';
import { validateRequestBody } from '$lib/server/validation';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const user = locals.user;

		if (user) {
			const media = await watchlistRepository.getWatchlist(user.id);
			return json(media);
		}

		return json([]);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;

		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const validatedBody = validateRequestBody(z.object({ mediaId: z.string() }), body);

		await watchlistRepository.addToWatchlist(user.id, validatedBody.mediaId);

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
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const validatedBody = validateRequestBody(
			z.object({
				mediaId: z.string().optional(),
				clearAll: z.boolean().optional()
			}),
			body
		);

		if (validatedBody.clearAll) {
			await watchlistRepository.clearWatchlist(user.id);
			return json({ success: true });
		}

		if (!validatedBody.mediaId) {
			throw new ValidationError('Media ID is required');
		}

		await watchlistRepository.removeFromWatchlist(user.id, validatedBody.mediaId);

		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
