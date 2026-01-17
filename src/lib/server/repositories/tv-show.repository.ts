import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	media,
	seasons,
	episodes,
	tvShowWatchStatus,
	seasonWatchStatus,
	episodeWatchStatus
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
	async createTVShow(showData: any): Promise<any> {
		const [result] = await db.insert(media).values({ ...showData, mediaType: 'tv' }).returning();
		return result;
	}

	async getTVShowById(id: string): Promise<any | null> {
		const [result] = await db.select().from(media).where(and(eq(media.id, id), eq(media.mediaType, 'tv')));
		return result || null;
	}

	async getTVShowByTmdbId(tmdbId: number): Promise<any | null> {
		const [result] = await db.select().from(media).where(and(eq(media.tmdbId, tmdbId), eq(media.mediaType, 'tv')));
		return result || null;
	}

	async getTVShowByImdbId(imdbId: string): Promise<any | null> {
		const [result] = await db.select().from(media).where(and(eq(media.imdbId, imdbId), eq(media.mediaType, 'tv')));
		return result || null;
	}

	async updateTVShow(
		id: string,
		updateData: any
	): Promise<any> {
		const [result] = await db
			.update(media)
			.set({ ...updateData, updatedAt: Date.now() })
			.where(eq(media.id, id))
			.returning();
		return result;
	}

	async deleteTVShow(id: string): Promise<void> {
		await db.delete(media).where(eq(media.id, id));
	}

	async createSeason(seasonData: Omit<Season, 'id' | 'createdAt' | 'updatedAt'>): Promise<Season> {
		const [result] = await db.insert(seasons).values(seasonData).returning();
		return result;
	}

	async getSeasonsByTVShowId(tvShowId: string): Promise<Season[]> {
		return await db
			.select()
			.from(seasons)
			.where(eq(seasons.mediaId, tvShowId))
			.orderBy(asc(seasons.seasonNumber));
	}

	async getSeasonById(id: string): Promise<Season | null> {
		const [result] = await db.select().from(seasons).where(eq(seasons.id, id));
		return result || null;
	}

	async getSeasonByNumber(tvShowId: string, seasonNumber: number): Promise<Season | null> {
		const [result] = await db
			.select()
			.from(seasons)
			.where(and(eq(seasons.mediaId, tvShowId), eq(seasons.seasonNumber, seasonNumber)));
		return result || null;
	}

	async updateSeason(
		id: string,
		updateData: Partial<Omit<Season, 'id' | 'createdAt'>>
	): Promise<Season> {
		const [result] = await db
			.update(seasons)
			.set({ ...updateData, updatedAt: Date.now() })
			.where(eq(seasons.id, id))
			.returning();
		return result;
	}

	async deleteSeason(id: string): Promise<void> {
		await db.delete(seasons).where(eq(seasons.id, id));
	}

	async createEpisode(
		episodeData: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<Episode> {
		const [result] = await db.insert(episodes).values(episodeData).returning();
		return result;
	}

	async getEpisodesBySeasonId(seasonId: string): Promise<Episode[]> {
		return await db
			.select()
			.from(episodes)
			.where(eq(episodes.seasonId, seasonId))
			.orderBy(asc(episodes.episodeNumber));
	}

	async getEpisodesByTVShowId(tvShowId: string): Promise<Episode[]> {
		return await db
			.select({
				id: episodes.id,
				mediaId: episodes.mediaId,
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
			.where(eq(seasons.mediaId, tvShowId))
			.orderBy(asc(seasons.seasonNumber), asc(episodes.episodeNumber));
	}

	async getEpisodeById(id: string): Promise<Episode | null> {
		const [result] = await db.select().from(episodes).where(eq(episodes.id, id));
		return result || null;
	}

	async getEpisodeByNumber(seasonId: string, episodeNumber: number): Promise<Episode | null> {
		const [result] = await db
			.select()
			.from(episodes)
			.where(and(eq(episodes.seasonId, seasonId), eq(episodes.episodeNumber, episodeNumber)));
		return result || null;
	}

	async updateEpisode(
		id: string,
		updateData: Partial<Omit<Episode, 'id' | 'createdAt'>>
	): Promise<Episode> {
		const [result] = await db
			.update(episodes)
			.set({ ...updateData, updatedAt: Date.now() })
			.where(eq(episodes.id, id))
			.returning();
		return result;
	}

	async deleteEpisode(id: string): Promise<void> {
		await db.delete(episodes).where(eq(episodes.id, id));
	}

	async getEpisodeWatchStatus(
		userId: string,
		episodeId: string
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
		episodeId: string,
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
		episodeId: string,
		watchTime: number = 0
	): Promise<EpisodeWatchStatus> {
		return await this.upsertEpisodeWatchStatus(userId, episodeId, {
			watched: true,
			watchTime,
			completedAt: Date.now()
		});
	}

	async markEpisodeAsUnwatched(userId: string, episodeId: string): Promise<EpisodeWatchStatus> {
		return await this.upsertEpisodeWatchStatus(userId, episodeId, {
			watched: false,
			watchTime: 0,
			completedAt: null
		});
	}

	async updateEpisodeProgress(
		userId: string,
		episodeId: string,
		watchTime: number,
		totalTime: number
	): Promise<EpisodeWatchStatus> {
		return await this.upsertEpisodeWatchStatus(userId, episodeId, {
			watchTime,
			totalTime,
			watched: watchTime >= totalTime * 0.9,
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
		seasonId: string
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

	async getSeasonWatchStatus(userId: string, seasonId: string): Promise<SeasonWatchStatus | null> {
		const [result] = await db
			.select()
			.from(seasonWatchStatus)
			.where(and(eq(seasonWatchStatus.userId, userId), eq(seasonWatchStatus.seasonId, seasonId)));
		return result || null;
	}

	async updateSeasonWatchStatus(userId: string, seasonId: string): Promise<SeasonWatchStatus> {
		const seasonEpisodes = await this.getEpisodesBySeasonId(seasonId);
		const totalEpisodes = seasonEpisodes.length;
		const watchedEpisodes = await this.getWatchedEpisodesForSeason(userId, seasonId);
		const episodesWatched = watchedEpisodes.length;

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

	async getTVShowWatchStatus(userId: string, tvShowId: string): Promise<TVShowWatchStatus | null> {
		const [result] = await db
			.select()
			.from(tvShowWatchStatus)
			.where(and(eq(tvShowWatchStatus.userId, userId), eq(tvShowWatchStatus.mediaId, tvShowId)));
		return (result as TVShowWatchStatus) || null;
	}

	async updateTVShowWatchStatus(userId: string, tvShowId: string): Promise<TVShowWatchStatus> {
		const showSeasons = await this.getSeasonsByTVShowId(tvShowId);
		const totalSeasons = showSeasons.length;

		const seasonIds = showSeasons.map((s) => s.id);
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
						.where(and(eq(seasonWatchStatus.userId, userId), eq(seasons.mediaId, tvShowId)))
				: [];

		const seasonsCompleted = seasonStatuses.filter((s) => s.completedAt !== null).length;
		const episodesWatched = seasonStatuses.reduce((sum, s) => sum + s.episodesWatched, 0);
		const totalEpisodes = seasonStatuses.reduce((sum, s) => sum + s.totalEpisodes, 0);

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
				.where(and(eq(tvShowWatchStatus.userId, userId), eq(tvShowWatchStatus.mediaId, tvShowId)))
				.returning();
			return result as TVShowWatchStatus;
		} else {
			const [result] = await db
				.insert(tvShowWatchStatus)
				.values({
					userId,
					mediaId: tvShowId,
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
		tvShowId: string,
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
				.where(and(eq(tvShowWatchStatus.userId, userId), eq(tvShowWatchStatus.mediaId, tvShowId)))
				.returning();
			return result as TVShowWatchStatus;
		} else {
			const [result] = await db
				.insert(tvShowWatchStatus)
				.values({
					userId,
					mediaId: tvShowId,
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
			Number(stat.watching || 0) + 
			Number(stat.completed || 0) + 
			Number(stat.onHold || 0) + 
			Number(stat.dropped || 0) + 
			Number(stat.planToWatch || 0);

		return {
			totalShows,
			watching: Number(stat.watching || 0),
			completed: Number(stat.completed || 0),
			onHold: Number(stat.onHold || 0),
			dropped: Number(stat.dropped || 0),
			planToWatch: Number(stat.planToWatch || 0),
			totalEpisodesWatched: Number(stat.totalEpisodesWatched || 0)
		};
	}

	async getContinueWatching(
		userId: string,
		limit: number = 10
	): Promise<
		Array<{
			tvShow: any;
			season: Season;
			episode: Episode;
			watchStatus: EpisodeWatchStatus;
		}>
	> {
		const result = await db
			.select({
				tvShow: media,
				season: seasons,
				episode: episodes,
				watchStatus: episodeWatchStatus
			})
			.from(episodeWatchStatus)
			.innerJoin(episodes, eq(episodeWatchStatus.episodeId, episodes.id))
			.innerJoin(seasons, eq(episodes.seasonId, seasons.id))
			.innerJoin(media, eq(seasons.mediaId, media.id))
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
