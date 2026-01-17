import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { media, genres, mediaGenres, collections } from '$lib/server/db/schema';
import { eq, and, count as drizzleCount, inArray, sql } from 'drizzle-orm';
import type { MediaRecord, MediaRow } from '$lib/server/db';
import { mapRowsToRecords, invalidateGenreCache } from '$lib/server/db/movie-select';
import { syncMovieCast, syncMovieCrew } from '$lib/server/services/person-sync.service';
import { validateMovieData } from './validation';

export const loadMovieById = async (id: string): Promise<MediaRecord | null> => {
	const rows = await db.select().from(media).where(eq(media.id, id)).limit(1);
	if (rows.length === 0) return null;
	const [m] = await mapRowsToRecords(rows as MediaRow[]);
	return m ?? null;
};

export const loadMovieByTmdb = async (tmdbId: number): Promise<MediaRecord | null> => {
	const rows = await db.select().from(media).where(eq(media.tmdbId, tmdbId)).limit(1);
	if (rows.length === 0) return null;
	const [m] = await mapRowsToRecords(rows as MediaRow[]);
	return m ?? null;
};

export type UpsertMoviePayload = {
	tmdbId: number;
	title: string;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	releaseDate: string | null;
	rating: number | null;
	durationMinutes: number | null;
	is4K: boolean;
	isHD: boolean;
	genreNames: string[];
	collectionId?: number | null;
	mediaType?: 'movie' | 'tv' | 'anime';
	imdbId: string | null;
	trailerUrl: string | null;
};

export const upsertMovieWithGenres = async (
	payload: UpsertMoviePayload
): Promise<MediaRecord | null> => {
	const results = await bulkUpsertMovies([payload]);
	return results[0] ?? null;
};

export const bulkUpsertMovies = async (payloads: UpsertMoviePayload[]): Promise<MediaRecord[]> => {
	if (payloads.length === 0) return [];

	return await db
		.transaction(async (tx) => {
			const allGenreNames = Array.from(
				new Set(payloads.flatMap((p) => p.genreNames.map((n) => n.trim())).filter(Boolean))
			);

			const existingGenres = await tx
				.select()
				.from(genres)
				.where(inArray(genres.name, allGenreNames));

			const genreMap = new Map(existingGenres.map((g) => [g.name, g.id]));

			const missingGenreNames = allGenreNames.filter((name) => !genreMap.has(name));
			if (missingGenreNames.length > 0) {
				const inserted = await tx
					.insert(genres)
					.values(missingGenreNames.map((name) => ({ name })))
					.returning({ id: genres.id, name: genres.name });

				for (const g of inserted) {
					genreMap.set(g.name, g.id);
				}
				invalidateGenreCache();
			}

			const tmdbIds = payloads.map((p) => p.tmdbId);
			const existingMedia = await tx
				.select()
				.from(media)
				.where(inArray(media.tmdbId, tmdbIds));

			const mediaMap = new Map();
			for (const m of existingMedia) {
				const key = `${m.tmdbId}:${m.mediaType}`;
				mediaMap.set(key, m);
			}

			const mediaToInsert: any[] = [];
			const results: MediaRecord[] = [];
			const genresToAssign: { mediaId: string; genreId: number }[] = [];

			for (const payload of payloads) {
				validateMovieData(payload);

				const mediaType = payload.mediaType || 'movie';
				const key = `${payload.tmdbId}:${mediaType}`;
				const existing = mediaMap.get(key);
				const mediaId = existing?.id ?? randomUUID();

				const mediaData: any = {
					id: mediaId,
					tmdbId: payload.tmdbId,
					title: payload.title,
					overview: payload.overview,
					posterPath: payload.posterPath,
					backdropPath: payload.backdropPath,
					releaseDate: payload.releaseDate,
					rating: payload.rating,
					durationMinutes: payload.durationMinutes,
					is4K: payload.is4K,
					isHD: payload.isHD,
					collectionId: payload.collectionId ?? (existing?.collectionId || null),
					mediaType: mediaType,
					imdbId: payload.imdbId ?? (existing?.imdbId || null),
					trailerUrl: payload.trailerUrl ?? (existing?.trailerUrl || null),
					createdAt: existing?.createdAt ?? Date.now(),
					updatedAt: Date.now()
				};

				mediaToInsert.push(mediaData);

				const payloadGenreIds = payload.genreNames
					.map((n) => genreMap.get(n.trim()))
					.filter((id): id is number => id !== undefined);

				for (const genreId of payloadGenreIds) {
					genresToAssign.push({ mediaId, genreId });
				}

				results.push(mediaData as unknown as MediaRecord);
			}

			if (mediaToInsert.length > 0) {
				await tx
					.insert(media)
					.values(mediaToInsert)
					.onConflictDoUpdate({
						target: [media.tmdbId],
						set: {
							title: sql`excluded.title`,
							overview: sql`excluded.overview`,
							posterPath: sql`excluded.posterPath`,
							backdropPath: sql`excluded.backdropPath`,
							releaseDate: sql`excluded.releaseDate`,
							rating: sql`excluded.rating`,
							durationMinutes: sql`excluded.durationMinutes`,
							is4K: sql`excluded.is4K`,
							isHD: sql`excluded.isHD`,
							collectionId: sql`excluded.collectionId`,
							imdbId: sql`excluded.imdbId`,
							trailerUrl: sql`excluded.trailerUrl`,
							updatedAt: sql`excluded.updatedAt`
						}
					});
			}

			const mediaIds = results.map((r) => r.id);
			if (mediaIds.length > 0) {
				await tx.delete(mediaGenres).where(inArray(mediaGenres.mediaId, mediaIds));
			}

			if (genresToAssign.length > 0) {
				await tx.insert(mediaGenres).values(genresToAssign).onConflictDoNothing();
			}

			return results;
		})
		.then(async (syncedMedia) => {
			const BATCH_SIZE = 5;
			for (let i = 0; i < syncedMedia.length; i += BATCH_SIZE) {
				const batch = syncedMedia.slice(i, i + BATCH_SIZE);
				await Promise.all(
					batch.map(async (m) => {
						try {
							await Promise.all([
								syncMovieCast(m.id, m.tmdbId!, m.mediaType as any),
								syncMovieCrew(m.id, m.tmdbId!, m.mediaType as any)
							]);
						} catch (error) {
							console.warn(`Failed to sync person data for media ${m.id}:`, error);
						}
					})
				);
			}
			return syncedMedia;
		});
};

export const setMovieCollection = async (movieId: string, collectionId: number | null) => {
	await db.update(media).set({ collectionId }).where(eq(media.id, movieId));
};

export const createCollection = async (
	name: string,
	description: string | null = null
): Promise<number> => {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	const existing = await db.select().from(collections).where(eq(collections.slug, slug)).limit(1);
	if (existing.length > 0) {
		return existing[0].id;
	}

	const result = await db
		.insert(collections)
		.values({ name, slug, description })
		.returning({ id: collections.id });
	return result[0].id;
};

export const countMovies = async (): Promise<number> => {
	const result = await db.select({ count: drizzleCount() }).from(media);
	return result[0].count;
};