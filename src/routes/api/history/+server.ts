import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { libraryRepository } from '$lib/server/repositories/library.repository';
import { z } from 'zod';
import { errorHandler, UnauthorizedError, ValidationError } from '$lib/server';
import { validateRequestBody, validateQueryParams } from '$lib/server/validation';

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json([]);
		}

		const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50;
		const history = await libraryRepository.getWatchHistory(user.id, limit);

		return json(history);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new UnauthorizedError('User must be logged in to save watch history');
		}

		const body = await request.json();
		const validatedBody = validateRequestBody(z.object({ mediaId: z.string() }), body);

		await libraryRepository.addToWatchHistory(user.id, validatedBody.mediaId);

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
			throw new UnauthorizedError('User must be logged in to clear watch history');
		}

		await libraryRepository.clearWatchHistory(user.id);

		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
