import { db } from '$lib/server/db';
import { watchlist, media, mediaGenres, genres } from '$lib/server/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import type { MediaSummary, MediaRow } from '$lib/server/db';
import { mapRowsToSummaries } from '$lib/server/db/movie-select';

export const watchlistRepository = {
	async getWatchlist(userId: string): Promise<MediaSummary[]> {
		try {
			const rows = await db
				.select({ media })
				.from(watchlist)
				.innerJoin(media, eq(watchlist.mediaId, media.id))
				.where(eq(watchlist.userId, userId))
				.orderBy(desc(watchlist.addedAt));

			const mediaRows = rows.map(r => r.media);
			return await mapRowsToSummaries(mediaRows as MediaRow[]);
		} catch (error) {
			console.error('Error fetching watchlist:', error);
			return [];
		}
	},

	async addToWatchlist(userId: string, mediaId: string): Promise<void> {
		try {
			await db
				.insert(watchlist)
				.values({
					userId,
					mediaId,
					addedAt: Date.now()
				})
				.onConflictDoUpdate({
					target: [watchlist.userId, watchlist.mediaId],
					set: {
						addedAt: Date.now()
					}
				});
		} catch (error) {
			console.error('Error adding to watchlist:', error);
			throw new Error('Failed to add to watchlist');
		}
	},

	async removeFromWatchlist(userId: string, mediaId: string): Promise<void> {
		try {
			await db
				.delete(watchlist)
				.where(and(eq(watchlist.userId, userId), eq(watchlist.mediaId, mediaId)));
		} catch (error) {
			console.error('Error removing from watchlist:', error);
			throw new Error('Failed to remove from watchlist');
		}
	},

	async clearWatchlist(userId: string): Promise<void> {
		try {
			await db.delete(watchlist).where(eq(watchlist.userId, userId));
		} catch (error) {
			console.error('Error clearing watchlist:', error);
			throw new Error('Failed to clear watchlist');
		}
	},

	async isInWatchlist(userId: string, mediaId: string): Promise<boolean> {
		try {
			const results = await db
				.select()
				.from(watchlist)
				.where(and(eq(watchlist.userId, userId), eq(watchlist.mediaId, mediaId)))
				.limit(1);
			return results.length > 0;
		} catch (error) {
			console.error('Error checking watchlist status:', error);
			return false;
		}
	}
};

export type WatchlistRepository = typeof watchlistRepository;