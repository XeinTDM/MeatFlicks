import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { playbackProgressRepository } from '$lib/server/repositories/playback-progress.repository';
import { z } from 'zod';
import {
	validateRequestBody,
	validateQueryParams
} from '$lib/server/validation';
import { errorHandler, UnauthorizedError } from '$lib/server';

const saveProgressSchema = z.object({
	mediaId: z.string(),
	mediaType: z.enum(['movie', 'tv']),
	progress: z.number().int().min(0),
	duration: z.number().int().min(1),
	seasonNumber: z.number().int().positive().optional(),
	episodeNumber: z.number().int().positive().optional()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new UnauthorizedError('User must be logged in to save playback progress');
		}

		const body = await request.json();
		const validatedBody = validateRequestBody(saveProgressSchema, body);

		await playbackProgressRepository.saveProgress(
			user.id,
			validatedBody.mediaId,
			validatedBody.mediaType,
			validatedBody.progress,
			validatedBody.duration,
			validatedBody.seasonNumber,
			validatedBody.episodeNumber
		);

		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new UnauthorizedError('User must be logged in to fetch playback progress');
		}

		const queryParams = validateQueryParams(
			z.object({
				mediaId: z.string().optional(),
				mediaType: z.enum(['movie', 'tv']).optional(),
				seasonNumber: z.coerce.number().int().positive().optional(),
				episodeNumber: z.coerce.number().int().positive().optional()
			}),
			url.searchParams
		);

		if (queryParams.mediaId && queryParams.mediaType) {
			const progress = await playbackProgressRepository.getProgress(
				user.id,
				queryParams.mediaId,
				queryParams.mediaType,
				queryParams.seasonNumber,
				queryParams.episodeNumber
			);

			return json({ progress });
		} else {
			const continueWatching = await playbackProgressRepository.getContinueWatching(user.id);
			return json({ continueWatching });
		}
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new UnauthorizedError('User must be logged in to delete playback progress');
		}

		const body = await request.json();
		const validatedBody = validateRequestBody(
			z.object({
				mediaId: z.string(),
				mediaType: z.enum(['movie', 'tv']),
				seasonNumber: z.number().int().positive().optional(),
				episodeNumber: z.number().int().positive().optional()
			}),
			body
		);

		await playbackProgressRepository.deleteProgress(
			user.id,
			validatedBody.mediaId,
			validatedBody.mediaType,
			validatedBody.seasonNumber,
			validatedBody.episodeNumber
		);

		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};