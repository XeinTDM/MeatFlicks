import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { playbackProgressRepository } from '$lib/server/repositories/playback-progress.repository';
import { z } from 'zod';
import {
	validateRequestBody,
	validateQueryParams,
	playbackProgressSchema
} from '$lib/server/validation';

const saveProgressSchema = z.object({
	mediaId: z.string(),
	mediaType: z.enum(['movie', 'tv']),
	progress: z.number().int().min(0),
	duration: z.number().int().min(1),
	seasonNumber: z.number().int().positive().optional(),
	episodeNumber: z.number().int().positive().optional()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
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
		console.error('Error saving playback progress:', error);
		return json({ error: 'Failed to save playback progress' }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ url, locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
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
		console.error('Error fetching playback progress:', error);
		return json({ error: 'Failed to fetch playback progress' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
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
		console.error('Error deleting playback progress:', error);
		return json({ error: 'Failed to delete playback progress' }, { status: 500 });
	}
};
