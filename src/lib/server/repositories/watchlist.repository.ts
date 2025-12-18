import { db } from '$lib/server/db';
import { watchlist } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export interface WatchlistRecord {
    id: string;
    movieData: string;
    addedAt: number;
}

export const watchlistRepository = {
    async getWatchlist(): Promise<any[]> {
        try {
            const rows = await db.select({ movieData: watchlist.movieData })
                .from(watchlist)
                .orderBy(desc(watchlist.addedAt));
            return rows.map((row) => JSON.parse(row.movieData));
        } catch (error) {
            console.error('Error fetching watchlist:', error);
            return [];
        }
    },

    async addToWatchlist(id: string, movie: any): Promise<void> {
        try {
            await db.insert(watchlist)
                .values({
                    id,
                    movieData: JSON.stringify(movie),
                    addedAt: movie.addedAt ? new Date(movie.addedAt).getTime() : Date.now()
                })
                .onConflictDoUpdate({
                    target: watchlist.id,
                    set: {
                        movieData: JSON.stringify(movie)
                    }
                });
        } catch (error) {
            console.error('Error adding to watchlist:', error);
            throw new Error('Failed to add to watchlist');
        }
    },

    async replaceWatchlist(moviesList: any[]): Promise<void> {
        try {
            await db.transaction(async (tx) => {
                await tx.delete(watchlist);
                for (const movie of moviesList) {
                    if (movie && movie.id) {
                        await tx.insert(watchlist).values({
                            id: movie.id,
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

    async removeFromWatchlist(id: string): Promise<void> {
        try {
            await db.delete(watchlist).where(eq(watchlist.id, id));
        } catch (error) {
            console.error('Error removing from watchlist:', error);
            throw new Error('Failed to remove from watchlist');
        }
    },

    async clearWatchlist(): Promise<void> {
        try {
            await db.delete(watchlist);
        } catch (error) {
            console.error('Error clearing watchlist:', error);
            throw new Error('Failed to clear watchlist');
        }
    }
};

export type WatchlistRepository = typeof watchlistRepository;
