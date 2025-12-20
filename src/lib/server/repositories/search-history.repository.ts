import { db } from '$lib/server/db';
import { searchHistory } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { MovieFilters } from '$lib/types/filters';

export interface SearchHistoryEntry {
	id: number;
	userId: string;
	query: string;
	filters: MovieFilters | null;
	searchedAt: number;
}

export const searchHistoryRepository = {
	/**
	 * Add a new search to history
	 */
	async addSearch(userId: string, query: string, filters?: MovieFilters): Promise<void> {
		try {
			const filtersJson = filters ? JSON.stringify(filters) : null;

			await db.insert(searchHistory).values({
				userId,
				query: query.trim(),
				filters: filtersJson,
				searchedAt: Date.now()
			});
		} catch (error) {
			console.error('Error adding search to history:', error);
			// Don't throw - search history is not critical
		}
	},

	/**
	 * Get recent searches for a user
	 */
	async getRecentSearches(userId: string, limit: number = 10): Promise<SearchHistoryEntry[]> {
		try {
			const results = await db
				.select()
				.from(searchHistory)
				.where(eq(searchHistory.userId, userId))
				.orderBy(desc(searchHistory.searchedAt))
				.limit(Math.min(limit, 50));

			return results.map((row) => ({
				id: row.id,
				userId: row.userId,
				query: row.query,
				filters: row.filters ? JSON.parse(row.filters) : null,
				searchedAt: row.searchedAt
			}));
		} catch (error) {
			console.error('Error fetching search history:', error);
			return [];
		}
	},

	/**
	 * Get unique recent search queries (without duplicates)
	 */
	async getUniqueRecentQueries(userId: string, limit: number = 10): Promise<string[]> {
		try {
			const searches = await this.getRecentSearches(userId, limit * 2);
			const uniqueQueries = new Set<string>();

			for (const search of searches) {
				if (search.query && search.query.trim()) {
					uniqueQueries.add(search.query.trim());
					if (uniqueQueries.size >= limit) break;
				}
			}

			return Array.from(uniqueQueries);
		} catch (error) {
			console.error('Error fetching unique search queries:', error);
			return [];
		}
	},

	/**
	 * Clear all search history for a user
	 */
	async clearHistory(userId: string): Promise<void> {
		try {
			await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
		} catch (error) {
			console.error('Error clearing search history:', error);
			throw new Error('Failed to clear search history');
		}
	},

	/**
	 * Delete a specific search entry
	 */
	async deleteSearch(userId: string, searchId: number): Promise<void> {
		try {
			await db.delete(searchHistory).where(eq(searchHistory.id, searchId));
		} catch (error) {
			console.error('Error deleting search:', error);
			throw new Error('Failed to delete search');
		}
	},

	/**
	 * Clean up old search history (older than 90 days)
	 */
	async cleanupOldSearches(): Promise<void> {
		try {
			const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
			await db.delete(searchHistory).where(eq(searchHistory.searchedAt, ninetyDaysAgo));
		} catch (error) {
			console.error('Error cleaning up old searches:', error);
			// Don't throw - cleanup is not critical
		}
	}
};

export type SearchHistoryRepository = typeof searchHistoryRepository;
