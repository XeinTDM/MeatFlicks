import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { playbackProgressRepository } from '$lib/server/repositories/playback-progress.repository';
import { z } from 'zod';

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
		const result = saveProgressSchema.safeParse(body);

		if (!result.success) {
			return json({ error: 'Invalid request data', details: result.error.format() }, { status: 400 });
		}

		await playbackProgressRepository.saveProgress(
			user.id,
			result.data.mediaId,
			result.data.mediaType,
			result.data.progress,
			result.data.duration,
			result.data.seasonNumber,
			result.data.episodeNumber
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
		const mediaId = url.searchParams.get('mediaId');
		const mediaType = url.searchParams.get('mediaType') as 'movie' | 'tv' | null;
		const seasonNumber = url.searchParams.get('seasonNumber');
		const episodeNumber = url.searchParams.get('episodeNumber');

		if (mediaId && mediaType) {
			// Get specific progress
			const progress = await playbackProgressRepository.getProgress(
				user.id,
				mediaId,
				mediaType,
				seasonNumber ? parseInt(seasonNumber, 10) : undefined,
				episodeNumber ? parseInt(episodeNumber, 10) : undefined
			);

			return json({ progress });
		} else {
			// Get continue watching list
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
		const { mediaId, mediaType, seasonNumber, episodeNumber } = body;

		if (!mediaId || !mediaType) {
			return json({ error: 'mediaId and mediaType are required' }, { status: 400 });
		}

		await playbackProgressRepository.deleteProgress(
			user.id,
			mediaId,
			mediaType,
			seasonNumber,
			episodeNumber
		);

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting playback progress:', error);
		return json({ error: 'Failed to delete playback progress' }, { status: 500 });
	}
};
