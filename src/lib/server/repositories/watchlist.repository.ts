import { db } from '$lib/server/db';
import { watchlist } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export interface WatchlistRecord {
	userId: string;
	movieId: string;
	movieData: string;
	addedAt: number;
}

export const watchlistRepository = {
	async getWatchlist(userId: string): Promise<any[]> {
		try {
			const results = await db
				.select()
				.from(watchlist)
				.where(eq(watchlist.userId, userId))
				.orderBy(desc(watchlist.addedAt));

			return results.map((record) => ({
				...JSON.parse(record.movieData),
				addedAt: record.addedAt
			}));
		} catch (error) {
			console.error('Error fetching watchlist:', error);
			return [];
		}
	},

	async addToWatchlist(userId: string, movie: any): Promise<void> {
		try {
			await db
				.insert(watchlist)
				.values({
					userId,
					movieId: movie.id,
					movieData: JSON.stringify(movie),
					addedAt: Date.now()
				})
				.onConflictDoUpdate({
					target: [watchlist.userId, watchlist.movieId],
					set: {
						movieData: JSON.stringify(movie)
					}
				});
		} catch (error) {
			console.error('Error adding to watchlist:', error);
			throw new Error('Failed to add to watchlist');
		}
	},

	async replaceWatchlist(userId: string, moviesList: any[]): Promise<void> {
		try {
			await db.transaction(async (tx) => {
				await tx.delete(watchlist).where(eq(watchlist.userId, userId));
				for (const movie of moviesList) {
					if (movie && movie.id) {
						await tx.insert(watchlist).values({
							userId,
							movieId: movie.id,
							movieData: JSON.stringify(movie),
							addedAt: movie.addedAt ? new Date(movie.addedAt).getTime() : Date.now()
						});
					}
				}
			});
		} catch (error) {
			console.error('Error replacing watchlist:', error);
			throw new Error('Failed to replace watchlist');
		}
	},

	async removeFromWatchlist(userId: string, movieId: string): Promise<void> {
		try {
			await db
				.delete(watchlist)
				.where(and(eq(watchlist.userId, userId), eq(watchlist.movieId, movieId)));
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
	}
};

export type WatchlistRepository = typeof watchlistRepository;
