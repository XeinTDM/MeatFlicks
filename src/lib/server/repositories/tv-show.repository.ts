import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	tvShows,
	seasons,
	episodes,
	tvShowWatchStatus,
	seasonWatchStatus,
	episodeWatchStatus,
	users
} from '$lib/server/db/schema';
import type {
	TVShow,
	Season,
	Episode,
	EpisodeWatchStatus,
	SeasonWatchStatus,
	TVShowWatchStatus
} from '$lib/types/tv-show';

export class TVShowRepository {
	async createTVShow(showData: Omit<TVShow, 'id' | 'createdAt' | 'updatedAt'>): Promise<TVShow> {
		const [result] = await db.insert(tvShows).values(showData).returning();
		return result;
	}

	async getTVShowById(id: number): Promise<TVShow | null> {
		const [result] = await db.select().from(tvShows).where(eq(tvShows.id, id));
		return result || null;
	}

	async getTVShowByTmdbId(tmdbId: number): Promise<TVShow | null> {
		const [result] = await db.select().from(tvShows).where(eq(tvShows.tmdbId, tmdbId));
		return result || null;
	}

	async getTVShowByImdbId(imdbId: string): Promise<TVShow | null> {
		const [result] = await db.select().from(tvShows).where(eq(tvShows.imdbId, imdbId));
		return result || null;
	}

	async updateTVShow(
		id: number,
		updateData: Partial<Omit<TVShow, 'id' | 'createdAt'>>
	): Promise<TVShow> {
		const [result] = await db
			.update(tvShows)
			.set({ ...updateData, updatedAt: Date.now() })
			.where(eq(tvShows.id, id))
			.returning();
		return result;
	}

	async deleteTVShow(id: number): Promise<void> {
		await db.delete(tvShows).where(eq(tvShows.id, id));
	}

	// Season operations
	async createSeason(seasonData: Omit<Season, 'id' | 'createdAt' | 'updatedAt'>): Promise<Season> {
		const [result] = await db.insert(seasons).values(seasonData).returning();
		return result;
	}

	async getSeasonsByTVShowId(tvShowId: number): Promise<Season[]> {
		return await db
			.select()
			.from(seasons)
			.where(eq(seasons.tvShowId, tvShowId))
			.orderBy(asc(seasons.seasonNumber));
	}

	async getSeasonById(id: number): Promise<Season | null> {
		const [result] = await db.select().from(seasons).where(eq(seasons.id, id));
		return result || null;
	}

	async getSeasonByNumber(tvShowId: number, seasonNumber: number): Promise<Season | null> {
		const [result] = await db
			.select()
			.from(seasons)
			.where(and(eq(seasons.tvShowId, tvShowId), eq(seasons.seasonNumber, seasonNumber)));
		return result || null;
	}

	async updateSeason(
		id: number,
		updateData: Partial<Omit<Season, 'id' | 'createdAt'>>
	): Promise<Season> {
		const [result] = await db
			.update(seasons)
			.set({ ...updateData, updatedAt: Date.now() })
			.where(eq(seasons.id, id))
			.returning();
		return result;
	}

	async deleteSeason(id: number): Promise<void> {
		await db.delete(seasons).where(eq(seasons.id, id));
	}

	// Episode operations
	async createEpisode(
		episodeData: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<Episode> {
		const [result] = await db.insert(episodes).values(episodeData).returning();
		return result;
	}

	async getEpisodesBySeasonId(seasonId: number): Promise<Episode[]> {
		return await db
			.select()
			.from(episodes)
			.where(eq(episodes.seasonId, seasonId))
			.orderBy(asc(episodes.episodeNumber));
	}

	async getEpisodesByTVShowId(tvShowId: number): Promise<Episode[]> {
		return await db
			.select({
				id: episodes.id,
				tvShowId: episodes.tvShowId,
				seasonId: episodes.seasonId,
				episodeNumber: episodes.episodeNumber,
				name: episodes.name,
				overview: episodes.overview,
				stillPath: episodes.stillPath,
				airDate: episodes.airDate,
				runtimeMinutes: episodes.runtimeMinutes,
				tmdbId: episodes.tmdbId,
				imdbId: episodes.imdbId,
				guestStars: episodes.guestStars,
				crew: episodes.crew,
				createdAt: episodes.createdAt,
				updatedAt: episodes.updatedAt
			})
			.from(episodes)
			.innerJoin(seasons, eq(episodes.seasonId, seasons.id))
			.where(eq(seasons.tvShowId, tvShowId))
			.orderBy(asc(seasons.seasonNumber), asc(episodes.episodeNumber));
	}

	async getEpisodeById(id: number): Promise<Episode | null> {
		const [result] = await db.select().from(episodes).where(eq(episodes.id, id));
		return result || null;
	}

	async getEpisodeByNumber(seasonId: number, episodeNumber: number): Promise<Episode | null> {
		const [result] = await db
			.select()
			.from(episodes)
			.where(and(eq(episodes.seasonId, seasonId), eq(episodes.episodeNumber, episodeNumber)));
		return result || null;
	}

	async updateEpisode(
		id: number,
		updateData: Partial<Omit<Episode, 'id' | 'createdAt'>>
	): Promise<Episode> {
		const [result] = await db
			.update(episodes)
			.set({ ...updateData, updatedAt: Date.now() })
			.where(eq(episodes.id, id))
			.returning();
		return result;
	}

	async deleteEpisode(id: number): Promise<void> {
		await db.delete(episodes).where(eq(episodes.id, id));
	}

	// Episode Watch Status operations
	async getEpisodeWatchStatus(
		userId: string,
		episodeId: number
	): Promise<EpisodeWatchStatus | null> {
		const [result] = await db
			.select()
			.from(episodeWatchStatus)
			.where(
				and(eq(episodeWatchStatus.userId, userId), eq(episodeWatchStatus.episodeId, episodeId))
			);
		return result || null;
	}

	async upsertEpisodeWatchStatus(
		userId: string,
		episodeId: number,
		statusData: Partial<Omit<EpisodeWatchStatus, 'id' | 'userId' | 'episodeId' | 'createdAt'>>
	): Promise<EpisodeWatchStatus> {
		const existing = await this.getEpisodeWatchStatus(userId, episodeId);

		if (existing) {
			const [result] = await db
				.update(episodeWatchStatus)
				.set({ ...statusData, updatedAt: Date.now() })
				.where(
					and(eq(episodeWatchStatus.userId, userId), eq(episodeWatchStatus.episodeId, episodeId))
				)
				.returning();
			return result as EpisodeWatchStatus;
		} else {
			const [result] = await db
				.insert(episodeWatchStatus)
				.values({
					userId,
					episodeId,
					...statusData,
					createdAt: Date.now(),
					updatedAt: Date.now()
				})
				.returning();
			return result as EpisodeWatchStatus;
		}
	}

	async markEpisodeAsWatched(
		userId: string,
		episodeId: number,
		watchTime: number = 0
	): Promise<EpisodeWatchStatus> {
		return await this.upsertEpisodeWatchStatus(userId, episodeId, {
			watched: true,
			watchTime,
			completedAt: Date.now()
		});
	}

	async markEpisodeAsUnwatched(userId: string, episodeId: number): Promise<EpisodeWatchStatus> {
		return await this.upsertEpisodeWatchStatus(userId, episodeId, {
			watched: false,
			watchTime: 0,
			completedAt: null
		});
	}

	async updateEpisodeProgress(
		userId: string,
		episodeId: number,
		watchTime: number,
		totalTime: number
	): Promise<EpisodeWatchStatus> {
		return await this.upsertEpisodeWatchStatus(userId, episodeId, {
			watchTime,
			totalTime,
			watched: watchTime >= totalTime * 0.9, // Mark as watched if 90% complete
			completedAt: watchTime >= totalTime * 0.9 ? Date.now() : null
		});
	}

	async getWatchedEpisodesForUser(userId: string): Promise<EpisodeWatchStatus[]> {
		return await db
			.select()
			.from(episodeWatchStatus)
			.where(and(eq(episodeWatchStatus.userId, userId), eq(episodeWatchStatus.watched, true)))
			.orderBy(desc(episodeWatchStatus.completedAt));
	}

	async getWatchedEpisodesForSeason(
		userId: string,
		seasonId: number
	): Promise<EpisodeWatchStatus[]> {
		return await db
			.select({
				id: episodeWatchStatus.id,
				userId: episodeWatchStatus.userId,
				episodeId: episodeWatchStatus.episodeId,
				watched: episodeWatchStatus.watched,
				watchTime: episodeWatchStatus.watchTime,
				totalTime: episodeWatchStatus.totalTime,
				completedAt: episodeWatchStatus.completedAt,
				createdAt: episodeWatchStatus.createdAt,
				updatedAt: episodeWatchStatus.updatedAt
			})
			.from(episodeWatchStatus)
			.innerJoin(episodes, eq(episodeWatchStatus.episodeId, episodes.id))
			.where(
				and(
					eq(episodeWatchStatus.userId, userId),
					eq(episodes.seasonId, seasonId),
					eq(episodeWatchStatus.watched, true)
				)
			)
			.orderBy(asc(episodes.episodeNumber));
	}

	// Season Watch Status operations
	async getSeasonWatchStatus(userId: string, seasonId: number): Promise<SeasonWatchStatus | null> {
		const [result] = await db
			.select()
			.from(seasonWatchStatus)
			.where(and(eq(seasonWatchStatus.userId, userId), eq(seasonWatchStatus.seasonId, seasonId)));
		return result || null;
	}

	async updateSeasonWatchStatus(userId: string, seasonId: number): Promise<SeasonWatchStatus> {
		// Get all episodes for this season
		const seasonEpisodes = await this.getEpisodesBySeasonId(seasonId);
		const totalEpisodes = seasonEpisodes.length;

		// Get watched episodes count
		const watchedEpisodes = await this.getWatchedEpisodesForSeason(userId, seasonId);
		const episodesWatched = watchedEpisodes.length;

		// Check if season is completed
		const isCompleted = episodesWatched === totalEpisodes && totalEpisodes > 0;

		const existing = await this.getSeasonWatchStatus(userId, seasonId);

		if (existing) {
			const [result] = await db
				.update(seasonWatchStatus)
				.set({
					episodesWatched,
					totalEpisodes,
					completedAt: isCompleted ? Date.now() : existing.completedAt,
					updatedAt: Date.now()
				})
				.where(and(eq(seasonWatchStatus.userId, userId), eq(seasonWatchStatus.seasonId, seasonId)))
				.returning();
			return result;
		} else {
			const [result] = await db
				.insert(seasonWatchStatus)
				.values({
					userId,
					seasonId,
					episodesWatched,
					totalEpisodes,
					completedAt: isCompleted ? Date.now() : null,
					createdAt: Date.now(),
					updatedAt: Date.now()
				})
				.returning();
			return result;
		}
	}

	// TV Show Watch Status operations
	async getTVShowWatchStatus(userId: string, tvShowId: number): Promise<TVShowWatchStatus | null> {
		const [result] = await db
			.select()
			.from(tvShowWatchStatus)
			.where(and(eq(tvShowWatchStatus.userId, userId), eq(tvShowWatchStatus.tvShowId, tvShowId)));
		return (result as TVShowWatchStatus) || null;
	}

	async updateTVShowWatchStatus(userId: string, tvShowId: number): Promise<TVShowWatchStatus> {
		// Get all seasons for this TV show
		const showSeasons = await this.getSeasonsByTVShowId(tvShowId);
		const totalSeasons = showSeasons.length;

		// Get season IDs for this TV show
		const seasonIds = showSeasons.map((s) => s.id);

		// Get season watch statuses by joining through seasons
		const seasonStatuses =
			seasonIds.length > 0
				? await db
						.select({
							id: seasonWatchStatus.id,
							userId: seasonWatchStatus.userId,
							seasonId: seasonWatchStatus.seasonId,
							episodesWatched: seasonWatchStatus.episodesWatched,
							totalEpisodes: seasonWatchStatus.totalEpisodes,
							completedAt: seasonWatchStatus.completedAt,
							createdAt: seasonWatchStatus.createdAt,
							updatedAt: seasonWatchStatus.updatedAt
						})
						.from(seasonWatchStatus)
						.innerJoin(seasons, eq(seasonWatchStatus.seasonId, seasons.id))
						.where(and(eq(seasonWatchStatus.userId, userId), eq(seasons.tvShowId, tvShowId)))
				: [];

		const seasonsCompleted = seasonStatuses.filter((s) => s.completedAt !== null).length;
		const episodesWatched = seasonStatuses.reduce((sum, s) => sum + s.episodesWatched, 0);
		const totalEpisodes = seasonStatuses.reduce((sum, s) => sum + s.totalEpisodes, 0);

		// Determine show status
		let status: 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch' = 'watching';
		if (episodesWatched === totalEpisodes && totalEpisodes > 0) {
			status = 'completed';
		}

		const existing = await this.getTVShowWatchStatus(userId, tvShowId);

		const updateData = {
			status,
			seasonsCompleted,
			totalSeasons,
			episodesWatched,
			totalEpisodes,
			completedAt:
				status === 'completed' && !existing?.completedAt ? Date.now() : existing?.completedAt,
			updatedAt: Date.now()
		};

		if (existing) {
			const [result] = await db
				.update(tvShowWatchStatus)
				.set(updateData)
				.where(and(eq(tvShowWatchStatus.userId, userId), eq(tvShowWatchStatus.tvShowId, tvShowId)))
				.returning();
			return result as TVShowWatchStatus;
		} else {
			const [result] = await db
				.insert(tvShowWatchStatus)
				.values({
					userId,
					tvShowId,
					...updateData,
					startedAt: Date.now(),
					createdAt: Date.now()
				})
				.returning();
			return result as TVShowWatchStatus;
		}
	}

	async setTVShowStatus(
		userId: string,
		tvShowId: number,
		status: 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch',
		rating?: number,
		notes?: string
	): Promise<TVShowWatchStatus> {
		const existing = await this.getTVShowWatchStatus(userId, tvShowId);

		const updateData = {
			status,
			rating: rating || null,
			notes: notes || null,
			startedAt: status === 'watching' && !existing?.startedAt ? Date.now() : existing?.startedAt,
			completedAt: status === 'completed' ? Date.now() : existing?.completedAt,
			updatedAt: Date.now()
		};

		if (existing) {
			const [result] = await db
				.update(tvShowWatchStatus)
				.set(updateData)
				.where(and(eq(tvShowWatchStatus.userId, userId), eq(tvShowWatchStatus.tvShowId, tvShowId)))
				.returning();
			return result as TVShowWatchStatus;
		} else {
			const [result] = await db
				.insert(tvShowWatchStatus)
				.values({
					userId,
					tvShowId,
					...updateData,
					seasonsCompleted: 0,
					totalSeasons: 0,
					episodesWatched: 0,
					totalEpisodes: 0,
					createdAt: Date.now()
				})
				.returning();
			return result as TVShowWatchStatus;
		}
	}

	// Statistics and queries
	async getUserTVShowStats(userId: string): Promise<{
		totalShows: number;
		watching: number;
		completed: number;
		onHold: number;
		dropped: number;
		planToWatch: number;
		totalEpisodesWatched: number;
	}> {
		const stats = await db
			.select({
				watching: sql<number>`SUM(CASE WHEN status = 'watching' THEN 1 ELSE 0 END)`,
				completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
				onHold: sql<number>`SUM(CASE WHEN status = 'on_hold' THEN 1 ELSE 0 END)`,
				dropped: sql<number>`SUM(CASE WHEN status = 'dropped' THEN 1 ELSE 0 END)`,
				planToWatch: sql<number>`SUM(CASE WHEN status = 'plan_to_watch' THEN 1 ELSE 0 END)`,
				totalEpisodesWatched: sql<number>`SUM(episodes_watched)`
			})
			.from(tvShowWatchStatus)
			.where(eq(tvShowWatchStatus.userId, userId));

		const stat = stats[0] || {
			watching: 0,
			completed: 0,
			onHold: 0,
			dropped: 0,
			planToWatch: 0,
			totalEpisodesWatched: 0
		};

		const totalShows =
			stat.watching + stat.completed + stat.onHold + stat.dropped + stat.planToWatch;

		return {
			totalShows,
			watching: stat.watching || 0,
			completed: stat.completed || 0,
			onHold: stat.onHold || 0,
			dropped: stat.dropped || 0,
			planToWatch: stat.planToWatch || 0,
			totalEpisodesWatched: stat.totalEpisodesWatched || 0
		};
	}

	async getContinueWatching(
		userId: string,
		limit: number = 10
	): Promise<
		Array<{
			tvShow: TVShow;
			season: Season;
			episode: Episode;
			watchStatus: EpisodeWatchStatus;
		}>
	> {
		// Get episodes that have been started but not completed
		const result = await db
			.select({
				tvShow: tvShows,
				season: seasons,
				episode: episodes,
				watchStatus: episodeWatchStatus
			})
			.from(episodeWatchStatus)
			.innerJoin(episodes, eq(episodeWatchStatus.episodeId, episodes.id))
			.innerJoin(seasons, eq(episodes.seasonId, seasons.id))
			.innerJoin(tvShows, eq(seasons.tvShowId, tvShows.id))
			.where(
				and(
					eq(episodeWatchStatus.userId, userId),
					sql`${episodeWatchStatus.watchTime} > 0`,
					sql`${episodeWatchStatus.watchTime} < ${episodeWatchStatus.totalTime}`
				)
			)
			.orderBy(desc(episodeWatchStatus.updatedAt))
			.limit(limit);

		return result;
	}
}

export const tvShowRepository = new TVShowRepository();
