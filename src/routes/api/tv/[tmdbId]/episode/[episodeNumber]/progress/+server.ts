import { json, type RequestHandler } from '@sveltejs/kit';
import { tvShowRepository } from '$lib/server/repositories/tv-show.repository';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const tmdbId = Number(params.tmdbId);
	const episodeNumber = Number(params.episodeNumber);

	if (!tmdbId || Number.isNaN(tmdbId) || !episodeNumber || Number.isNaN(episodeNumber)) {
		return json({ error: 'Invalid parameters' }, { status: 400 });
	}

	try {
		// Get TV show from database
		const tvShow = await tvShowRepository.getTVShowByTmdbId(tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		// Get season from query params (default to 1 if not provided)
		const seasonNumber = Number(url.searchParams.get('season')) || 1;

		// Get season
		const season = await tvShowRepository.getSeasonByNumber(tvShow.id, seasonNumber);
		if (!season) {
			return json({ error: 'Season not found' }, { status: 404 });
		}

		// Get episode
		const episode = await tvShowRepository.getEpisodeByNumber(season.id, episodeNumber);
		if (!episode) {
			return json({ error: 'Episode not found' }, { status: 404 });
		}

		// Get episode watch status
		const watchStatus = await tvShowRepository.getEpisodeWatchStatus(user.id, episode.id);

		return json({
			episode,
			watchStatus
		});
	} catch (error) {
		console.error('[API][tv][episode][progress][GET] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const tmdbId = Number(params.tmdbId);
	const episodeNumber = Number(params.episodeNumber);

	if (!tmdbId || Number.isNaN(tmdbId) || !episodeNumber || Number.isNaN(episodeNumber)) {
		return json({ error: 'Invalid parameters' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { watchTime, totalTime, season: seasonNumber = 1 } = body;

		if (typeof watchTime !== 'number' || typeof totalTime !== 'number') {
			return json({ error: 'Invalid progress data' }, { status: 400 });
		}

		// Get TV show from database
		const tvShow = await tvShowRepository.getTVShowByTmdbId(tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		// Get season
		const season = await tvShowRepository.getSeasonByNumber(tvShow.id, seasonNumber);
		if (!season) {
			return json({ error: 'Season not found' }, { status: 404 });
		}

		// Get episode
		const episode = await tvShowRepository.getEpisodeByNumber(season.id, episodeNumber);
		if (!episode) {
			return json({ error: 'Episode not found' }, { status: 404 });
		}

		// Update episode progress
		const watchStatus = await tvShowRepository.updateEpisodeProgress(
			user.id,
			episode.id,
			watchTime,
			totalTime
		);

		// Update season status
		await tvShowRepository.updateSeasonWatchStatus(user.id, season.id);

		// Update TV show status
		await tvShowRepository.updateTVShowWatchStatus(user.id, tvShow.id);

		return json({
			success: true,
			watchStatus
		});
	} catch (error) {
		console.error('[API][tv][episode][progress][POST] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const tmdbId = Number(params.tmdbId);
	const episodeNumber = Number(params.episodeNumber);

	if (!tmdbId || Number.isNaN(tmdbId) || !episodeNumber || Number.isNaN(episodeNumber)) {
		return json({ error: 'Invalid parameters' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { watched, season: seasonNumber = 1 } = body;

		if (typeof watched !== 'boolean') {
			return json({ error: 'Invalid watched status' }, { status: 400 });
		}

		// Get TV show from database
		const tvShow = await tvShowRepository.getTVShowByTmdbId(tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		// Get season
		const season = await tvShowRepository.getSeasonByNumber(tvShow.id, seasonNumber);
		if (!season) {
			return json({ error: 'Season not found' }, { status: 404 });
		}

		// Get episode
		const episode = await tvShowRepository.getEpisodeByNumber(season.id, episodeNumber);
		if (!episode) {
			return json({ error: 'Episode not found' }, { status: 404 });
		}

		// Mark episode as watched/unwatched
		const watchStatus = watched
			? await tvShowRepository.markEpisodeAsWatched(user.id, episode.id)
			: await tvShowRepository.markEpisodeAsUnwatched(user.id, episode.id);

		// Update season status
		await tvShowRepository.updateSeasonWatchStatus(user.id, season.id);

		// Update TV show status
		await tvShowRepository.updateTVShowWatchStatus(user.id, tvShow.id);

		return json({
			success: true,
			watchStatus
		});
	} catch (error) {
		console.error('[API][tv][episode][progress][PUT] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
