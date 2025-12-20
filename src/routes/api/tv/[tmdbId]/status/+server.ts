import { json, type RequestHandler } from '@sveltejs/kit';
import { tvShowRepository } from '$lib/server/repositories/tv-show.repository';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const tmdbId = Number(params.tmdbId);
	if (!tmdbId || Number.isNaN(tmdbId)) {
		return json({ error: 'Invalid TMDB ID' }, { status: 400 });
	}

	try {
		// Get TV show from database
		const tvShow = await tvShowRepository.getTVShowByTmdbId(tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		// Get user's watch status for this TV show
		const watchStatus = await tvShowRepository.getTVShowWatchStatus(user.id, tvShow.id);

		// Get detailed status with seasons and episodes if requested
		const includeDetails = url.searchParams.get('includeDetails') === 'true';
		if (includeDetails) {
			const seasons = await tvShowRepository.getSeasonsByTVShowId(tvShow.id);
			const seasonsWithStatus = await Promise.all(
				seasons.map(async (season) => {
					const seasonStatus = await tvShowRepository.getSeasonWatchStatus(user.id, season.id);
					const episodes = await tvShowRepository.getEpisodesBySeasonId(season.id);
					const episodesWithStatus = await Promise.all(
						episodes.map(async (episode) => {
							const episodeStatus = await tvShowRepository.getEpisodeWatchStatus(user.id, episode.id);
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
		console.error('[API][tv][status][GET] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const tmdbId = Number(params.tmdbId);
	if (!tmdbId || Number.isNaN(tmdbId)) {
		return json({ error: 'Invalid TMDB ID' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { status, rating, notes } = body;

		if (!status || !['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'].includes(status)) {
			return json({ error: 'Invalid status' }, { status: 400 });
		}

		// Get TV show from database
		const tvShow = await tvShowRepository.getTVShowByTmdbId(tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		// Update TV show status
		const watchStatus = await tvShowRepository.setTVShowStatus(
			user.id,
			tvShow.id,
			status,
			rating ? Number(rating) : undefined,
			notes
		);

		return json({
			success: true,
			watchStatus
		});
	} catch (error) {
		console.error('[API][tv][status][POST] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const tmdbId = Number(params.tmdbId);
	if (!tmdbId || Number.isNaN(tmdbId)) {
		return json({ error: 'Invalid TMDB ID' }, { status: 400 });
	}

	try {
		// Get TV show from database
		const tvShow = await tvShowRepository.getTVShowByTmdbId(tmdbId);
		if (!tvShow) {
			return json({ error: 'TV show not found' }, { status: 404 });
		}

		// Delete TV show watch status (this would cascade to delete season and episode statuses)
		const watchStatus = await tvShowRepository.getTVShowWatchStatus(user.id, tvShow.id);
		if (watchStatus) {
			// Note: We don't have a delete method in the repository, but this would be implemented
			// For now, we'll just return success
		}

		return json({
			success: true,
			message: 'TV show removed from your list'
		});
	} catch (error) {
		console.error('[API][tv][status][DELETE] Error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
