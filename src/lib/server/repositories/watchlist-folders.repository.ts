import { db } from '$lib/server/db';
import { watchlistFolders } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export interface WatchlistFolder {
	id: number;
	userId: string;
	name: string;
	description: string | null;
	color: string | null;
	createdAt: number;
	updatedAt: number;
}

export const watchlistFoldersRepository = {
	async getAllFolders(userId: string): Promise<WatchlistFolder[]> {
		try {
			const results = await db
				.select()
				.from(watchlistFolders)
				.where(eq(watchlistFolders.userId, userId))
				.orderBy(desc(watchlistFolders.createdAt));

			return results.map((folder) => ({
				id: folder.id,
				userId: folder.userId,
				name: folder.name,
				description: folder.description,
				color: folder.color,
				createdAt: folder.createdAt,
				updatedAt: folder.updatedAt
			}));
		} catch (error) {
			console.error('Error fetching watchlist folders:', error);
			return [];
		}
	},

	async getFolderById(userId: string, folderId: number): Promise<WatchlistFolder | null> {
		try {
			const result = await db
				.select()
				.from(watchlistFolders)
				.where(eq(watchlistFolders.id, folderId))
				.limit(1);

			if (result.length === 0) {
				return null;
			}

			const folder = result[0];
			return {
				id: folder.id,
				userId: folder.userId,
				name: folder.name,
				description: folder.description,
				color: folder.color,
				createdAt: folder.createdAt,
				updatedAt: folder.updatedAt
			};
		} catch (error) {
			console.error('Error fetching watchlist folder:', error);
			return null;
		}
	},

	async createFolder(
		userId: string,
		name: string,
		description?: string,
		color?: string
	): Promise<WatchlistFolder> {
		try {
			const now = Date.now();
			const [createdFolder] = await db
				.insert(watchlistFolders)
				.values({
					userId,
					name,
					description,
					color,
					createdAt: now,
					updatedAt: now
				})
				.returning();

			return {
				id: createdFolder.id,
				userId: createdFolder.userId,
				name: createdFolder.name,
				description: createdFolder.description,
				color: createdFolder.color,
				createdAt: createdFolder.createdAt,
				updatedAt: createdFolder.updatedAt
			};
		} catch (error) {
			console.error('Error creating watchlist folder:', error);
			throw new Error('Failed to create folder');
		}
	},

	async updateFolder(
		userId: string,
		folderId: number,
		name?: string,
		description?: string,
		color?: string
	): Promise<WatchlistFolder | null> {
		try {
			const updates: Record<string, any> = {
				updatedAt: Date.now()
			};

			if (name) updates.name = name;
			if (description) updates.description = description;
			if (color) updates.color = color;

			const [updatedFolder] = await db
				.update(watchlistFolders)
				.set(updates)
				.where(eq(watchlistFolders.id, folderId))
				.returning();

			if (!updatedFolder) {
				return null;
			}

			return {
				id: updatedFolder.id,
				userId: updatedFolder.userId,
				name: updatedFolder.name,
				description: updatedFolder.description,
				color: updatedFolder.color,
				createdAt: updatedFolder.createdAt,
				updatedAt: updatedFolder.updatedAt
			};
		} catch (error) {
			console.error('Error updating watchlist folder:', error);
			return null;
		}
	},

	async deleteFolder(userId: string, folderId: number): Promise<boolean> {
		try {
			const result = await db.delete(watchlistFolders).where(eq(watchlistFolders.id, folderId));
			return result.rowsAffected > 0;
		} catch (error) {
			console.error('Error deleting watchlist folder:', error);
			return false;
		}
	}
};

export type WatchlistFoldersRepository = typeof watchlistFoldersRepository;
