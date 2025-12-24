import { json, type RequestHandler } from '@sveltejs/kit';
import { tvShowRepository } from '$lib/server/repositories/tv-show.repository';
import { z } from 'zod';
import { validatePathParams, validateQueryParams, tmdbIdSchema } from '$lib/server/validation';
import { errorHandler } from '$lib/server';

const episodeProgressPathParamsSchema = z.object({
	tmdbId: tmdbIdSchema,
	episodeNumber: z.coerce.number().int().positive()
});

const episodeProgressQueryParamsSchema = z.object({
	season: z.coerce.number().int().positive().default(1)
});

export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new Error('Unauthorized');
		}

		const pathParams = validatePathParams(episodeProgressPathParamsSchema, params);
		const queryParams = validateQueryParams(episodeProgressQueryParamsSchema, url.searchParams);

		const tvShow = await tvShowRepository.getTVShowByTmdbId(pathParams.tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		const season = await tvShowRepository.getSeasonByNumber(tvShow.id, queryParams.season);
		if (!season) {
			return json({ error: 'Season not found' }, { status: 404 });
		}

		const episode = await tvShowRepository.getEpisodeByNumber(season.id, pathParams.episodeNumber);
		if (!episode) {
			return json({ error: 'Episode not found' }, { status: 404 });
		}

		const watchStatus = await tvShowRepository.getEpisodeWatchStatus(user.id, episode.id);

		return json({
			episode,
			watchStatus
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

import { validateRequestBody } from '$lib/server/validation';

const episodeProgressUpdateSchema = z.object({
	watchTime: z.number().int().min(0),
	totalTime: z.number().int().positive(),
	season: z.number().int().positive().default(1)
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new Error('Unauthorized');
		}

		const pathParams = validatePathParams(episodeProgressPathParamsSchema, params);

		const body = validateRequestBody(episodeProgressUpdateSchema, await request.json());

		const tvShow = await tvShowRepository.getTVShowByTmdbId(pathParams.tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		const season = await tvShowRepository.getSeasonByNumber(tvShow.id, body.season);
		if (!season) {
			return json({ error: 'Season not found' }, { status: 404 });
		}

		const episode = await tvShowRepository.getEpisodeByNumber(season.id, pathParams.episodeNumber);
		if (!episode) {
			return json({ error: 'Episode not found' }, { status: 404 });
		}

		const watchStatus = await tvShowRepository.updateEpisodeProgress(
			user.id,
			episode.id,
			body.watchTime,
			body.totalTime
		);

		await tvShowRepository.updateSeasonWatchStatus(user.id, season.id);

		await tvShowRepository.updateTVShowWatchStatus(user.id, tvShow.id);

		return json({
			success: true,
			watchStatus
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

const episodeWatchedUpdateSchema = z.object({
	watched: z.boolean(),
	season: z.number().int().positive().default(1)
});

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new Error('Unauthorized');
		}

		const pathParams = validatePathParams(episodeProgressPathParamsSchema, params);

		const body = validateRequestBody(episodeWatchedUpdateSchema, await request.json());

		const tvShow = await tvShowRepository.getTVShowByTmdbId(pathParams.tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		const season = await tvShowRepository.getSeasonByNumber(tvShow.id, body.season);
		if (!season) {
			return json({ error: 'Season not found' }, { status: 404 });
		}

		const episode = await tvShowRepository.getEpisodeByNumber(season.id, pathParams.episodeNumber);
		if (!episode) {
			return json({ error: 'Episode not found' }, { status: 404 });
		}

		const watchStatus = body.watched
			? await tvShowRepository.markEpisodeAsWatched(user.id, episode.id)
			: await tvShowRepository.markEpisodeAsUnwatched(user.id, episode.id);

		await tvShowRepository.updateSeasonWatchStatus(user.id, season.id);

		await tvShowRepository.updateTVShowWatchStatus(user.id, tvShow.id);

		return json({
			success: true,
			watchStatus
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
