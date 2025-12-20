import { json, type RequestHandler } from '@sveltejs/kit';
import { tvShowRepository } from '$lib/server/repositories/tv-show.repository';
import { z } from 'zod';
import { validatePathParams, validateQueryParams, tmdbIdSchema } from '$lib/server/validation';
import { errorHandler } from '$lib/server';

const tvStatusPathParamsSchema = z.object({
	tmdbId: tmdbIdSchema
});

const tvStatusQueryParamsSchema = z.object({
	includeDetails: z.enum(['true', 'false']).transform(val => val === 'true').optional()
});

export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new Error('Unauthorized');
		}

		// Validate path parameters
		const pathParams = validatePathParams(tvStatusPathParamsSchema, params);

		// Validate query parameters
		const queryParams = validateQueryParams(tvStatusQueryParamsSchema, url.searchParams);

		const tvShow = await tvShowRepository.getTVShowByTmdbId(pathParams.tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		const watchStatus = await tvShowRepository.getTVShowWatchStatus(user.id, tvShow.id);

		const includeDetails = queryParams.includeDetails ?? false;
		if (includeDetails) {
			const seasons = await tvShowRepository.getSeasonsByTVShowId(tvShow.id);
			const seasonsWithStatus = await Promise.all(
				seasons.map(async (season) => {
					const seasonStatus = await tvShowRepository.getSeasonWatchStatus(user.id, season.id);
					const episodes = await tvShowRepository.getEpisodesBySeasonId(season.id);
					const episodesWithStatus = await Promise.all(
						episodes.map(async (episode) => {
							const episodeStatus = await tvShowRepository.getEpisodeWatchStatus(
								user.id,
								episode.id
							);
							return {
								...episode,
								watchStatus: episodeStatus
							};
						})
					);
					return {
						...season,
						episodes: episodesWithStatus,
						watchStatus: seasonStatus
					};
				})
			);

			return json({
				tvShow,
				watchStatus,
				seasons: seasonsWithStatus
			});
		}

		return json({
			tvShow,
			watchStatus
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

import { validateRequestBody } from '$lib/server/validation';

const tvStatusUpdateSchema = z.object({
	status: z.enum(['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch']),
	rating: z.coerce.number().int().min(1).max(10).optional(),
	notes: z.string().optional()
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new Error('Unauthorized');
		}

		// Validate path parameters
		const pathParams = validatePathParams(tvStatusPathParamsSchema, params);

		// Validate request body
		const body = validateRequestBody(tvStatusUpdateSchema, await request.json());

		const tvShow = await tvShowRepository.getTVShowByTmdbId(pathParams.tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		const watchStatus = await tvShowRepository.setTVShowStatus(
			user.id,
			tvShow.id,
			body.status,
			body.rating,
			body.notes
		);

		return json({
			success: true,
			watchStatus
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new Error('Unauthorized');
		}

		// Validate path parameters
		const pathParams = validatePathParams(tvStatusPathParamsSchema, params);

		const tvShow = await tvShowRepository.getTVShowByTmdbId(pathParams.tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		// Remove the watch status for this TV show by setting it to 'dropped'
		await tvShowRepository.setTVShowStatus(user.id, tvShow.id, 'dropped');

		return json({
			success: true,
			message: 'TV show removed from your list'
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
