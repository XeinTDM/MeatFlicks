import Bottleneck from 'bottleneck';
import { logger } from '../logger';
import { db } from '../db';
import { media as mediaTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { fetchTmdbMovieDetails, fetchTmdbTvDetails, fetchTmdbMovieExtras } from './tmdb.service';
import { upsertMovieWithGenres } from '../db/mutations';

// Limit background sync to 1 request per second to avoid hitting limits
const syncLimiter = new Bottleneck({
	maxConcurrent: 2,
	minTime: 1000
});

export type SyncPriority = 'high' | 'medium' | 'low';

const SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export const mediaSyncService = {
	/**
	 * Schedules a background sync for a specific media item.
	 * Returns immediately.
	 */
	async scheduleSync(
		tmdbId: number,
		mediaType: 'movie' | 'tv' | 'anime',
		priority: SyncPriority = 'medium'
	) {
		const cacheKey = `sync:${mediaType}:${tmdbId}`;

		// Use a simple set to avoid redundant tasks in memory during this process session
		if (activeSyncs.has(cacheKey)) return;

		activeSyncs.add(cacheKey);

		syncLimiter.schedule(
			{ priority: priority === 'high' ? 1 : priority === 'medium' ? 5 : 9 },
			async () => {
				try {
					await this.performSync(tmdbId, mediaType);
				} catch (error) {
					logger.error({ error, tmdbId, mediaType }, '[media-sync] background sync failed');
				} finally {
					activeSyncs.delete(cacheKey);
				}
			}
		);
	},

	/**
	 * Checks if an item needs syncing based on updatedAt timestamp
	 */
	needsSync(updatedAt: number | null | undefined): boolean {
		if (!updatedAt) return true;
		return Date.now() - updatedAt > SYNC_COOLDOWN_MS;
	},

	/**
	 * Performs the actual sync logic
	 */
	async performSync(tmdbId: number, mediaType: 'movie' | 'tv' | 'anime') {
		logger.info({ tmdbId, mediaType }, '[media-sync] starting sync');

		try {
			if (mediaType === 'tv') {
				const details = await fetchTmdbTvDetails(tmdbId);
				if (!details.found) return;

				const genreNames = details.genres.map((g) => g.name);

				await upsertMovieWithGenres({
					tmdbId,
					title: details.name || 'Untitled',
					overview: details.overview,
					posterPath: details.posterPath,
					backdropPath: details.backdropPath,
					releaseDate: details.firstAirDate,
					rating: details.rating,
					durationMinutes: details.episodeRuntimes?.[0] ?? null,
					is4K: false,
					isHD: true,
					genreNames,
					mediaType: 'tv',
					imdbId: details.imdbId,
					trailerUrl: details.trailerUrl
				});

				// Update TV specific fields
				await db
					.update(mediaTable)
					.set({
						status: details.status,
						numberOfSeasons: details.seasonCount,
						numberOfEpisodes: details.episodeCount,
						productionCompanies: JSON.stringify(details.productionCompanies),
						updatedAt: Date.now()
					})
					.where(eq(mediaTable.tmdbId, tmdbId));
			} else {
				const details = await fetchTmdbMovieDetails(tmdbId);
				if (!details.found) return;

				const genreNames = details.genres.map((g) => g.name);

				await upsertMovieWithGenres({
					tmdbId,
					title: details.title || 'Untitled',
					overview: details.overview,
					posterPath: details.posterPath,
					backdropPath: details.backdropPath,
					releaseDate: details.releaseDate,
					rating: details.rating,
					durationMinutes: details.runtime,
					is4K: false,
					isHD: true,
					genreNames,
					mediaType: mediaType === 'anime' ? 'anime' : 'movie',
					imdbId: details.imdbId,
					trailerUrl: details.trailerUrl
				});
			}

			logger.info({ tmdbId, mediaType }, '[media-sync] sync completed');
		} catch (error) {
			logger.error({ error, tmdbId, mediaType }, '[media-sync] performSync failed');
			throw error;
		}
	}
};

const activeSyncs = new Set<string>();
