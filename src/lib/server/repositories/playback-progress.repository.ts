import { db } from '$lib/server/db';
import { playbackProgress } from '$lib/server/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';

export interface PlaybackProgressRecord {
	id: number;
	userId: string;
	mediaId: string;
	mediaType: 'movie' | 'tv';
	progress: number;
	duration: number;
	seasonNumber: number | null;
	episodeNumber: number | null;
	updatedAt: number;
}

export const playbackProgressRepository = {
	async saveProgress(
		userId: string,
		mediaId: string,
		mediaType: 'movie' | 'tv',
		progress: number,
		duration: number,
		seasonNumber?: number,
		episodeNumber?: number
	): Promise<void> {
		try {
			const conditions = [
				eq(playbackProgress.userId, userId),
				eq(playbackProgress.mediaId, mediaId),
				eq(playbackProgress.mediaType, mediaType)
			];

			if (seasonNumber !== undefined) {
				conditions.push(eq(playbackProgress.seasonNumber, seasonNumber));
			} else {
				conditions.push(isNull(playbackProgress.seasonNumber));
			}

			if (episodeNumber !== undefined) {
				conditions.push(eq(playbackProgress.episodeNumber, episodeNumber));
			} else {
				conditions.push(isNull(playbackProgress.episodeNumber));
			}

			const existing = await db
				.select()
				.from(playbackProgress)
				.where(and(...conditions))
				.limit(1);

			if (existing.length > 0) {
				await db
					.update(playbackProgress)
					.set({
						progress,
						duration,
						updatedAt: Date.now()
					})
					.where(eq(playbackProgress.id, existing[0].id));
			} else {
				await db.insert(playbackProgress).values({
					userId,
					mediaId,
					mediaType,
					progress,
					duration,
					seasonNumber: seasonNumber ?? null,
					episodeNumber: episodeNumber ?? null,
					updatedAt: Date.now()
				});
			}
		} catch (error) {
			console.error('Error saving playback progress:', error);
			throw new Error('Failed to save playback progress');
		}
	},

	async getProgress(
		userId: string,
		mediaId: string,
		mediaType: 'movie' | 'tv',
		seasonNumber?: number,
		episodeNumber?: number
	): Promise<PlaybackProgressRecord | null> {
		try {
			const conditions = [
				eq(playbackProgress.userId, userId),
				eq(playbackProgress.mediaId, mediaId),
				eq(playbackProgress.mediaType, mediaType)
			];

			if (seasonNumber !== undefined) {
				conditions.push(eq(playbackProgress.seasonNumber, seasonNumber));
			} else {
				conditions.push(isNull(playbackProgress.seasonNumber));
			}

			if (episodeNumber !== undefined) {
				conditions.push(eq(playbackProgress.episodeNumber, episodeNumber));
			} else {
				conditions.push(isNull(playbackProgress.episodeNumber));
			}

			const results = await db
				.select()
				.from(playbackProgress)
				.where(and(...conditions))
				.limit(1);

			if (results[0]) {
				return {
					...results[0],
					mediaType: results[0].mediaType as 'movie' | 'tv'
				};
			}
			return null;
		} catch (error) {
			console.error('Error fetching playback progress:', error);
			return null;
		}
	},

	async getContinueWatching(userId: string, limit: number = 20): Promise<PlaybackProgressRecord[]> {
		try {
			const results = await db
				.select()
				.from(playbackProgress)
				.where(eq(playbackProgress.userId, userId))
				.orderBy(desc(playbackProgress.updatedAt))
				.limit(limit);

			return results
				.filter((record) => {
					const progressPercent = (record.progress / record.duration) * 100;
					return progressPercent < 90;
				})
				.map((record) => ({
					...record,
					mediaType: record.mediaType as 'movie' | 'tv'
				}));
		} catch (error) {
			console.error('Error fetching continue watching:', error);
			return [];
		}
	},

	async deleteProgress(
		userId: string,
		mediaId: string,
		mediaType: 'movie' | 'tv',
		seasonNumber?: number,
		episodeNumber?: number
	): Promise<void> {
		try {
			const conditions = [
				eq(playbackProgress.userId, userId),
				eq(playbackProgress.mediaId, mediaId),
				eq(playbackProgress.mediaType, mediaType)
			];

			if (seasonNumber !== undefined) {
				conditions.push(eq(playbackProgress.seasonNumber, seasonNumber));
			} else {
				conditions.push(isNull(playbackProgress.seasonNumber));
			}

			if (episodeNumber !== undefined) {
				conditions.push(eq(playbackProgress.episodeNumber, episodeNumber));
			} else {
				conditions.push(isNull(playbackProgress.episodeNumber));
			}

			await db.delete(playbackProgress).where(and(...conditions));
		} catch (error) {
			console.error('Error deleting playback progress:', error);
			throw new Error('Failed to delete playback progress');
		}
	}
};

export type PlaybackProgressRepository = typeof playbackProgressRepository;
