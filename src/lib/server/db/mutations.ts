import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { movies, genres, moviesGenres, collections } from '$lib/server/db/schema';
import { eq, sql, and, count as drizzleCount } from 'drizzle-orm';
import type { GenreRecord, MovieRecord, MovieRow } from '$lib/server/db';
import { mapRowsToRecords } from '$lib/server/db/movie-select';

export const loadMovieById = async (id: string): Promise<MovieRecord | null> => {
	const rows = await db.select().from(movies).where(eq(movies.id, id)).limit(1);
	if (rows.length === 0) return null;
	const [movie] = await mapRowsToRecords(rows as MovieRow[]);
	return movie ?? null;
};

export const loadMovieByTmdb = async (tmdbId: number): Promise<MovieRecord | null> => {
	const rows = await db.select().from(movies).where(eq(movies.tmdbId, tmdbId)).limit(1);
	if (rows.length === 0) return null;
	const [movie] = await mapRowsToRecords(rows as MovieRow[]);
	return movie ?? null;
};

type UpsertMoviePayload = {
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
};

export const upsertMovieWithGenres = async (payload: UpsertMoviePayload): Promise<MovieRecord | null> => {
	return await db.transaction(async (tx) => {
		const genreIds: number[] = [];
		for (const rawName of payload.genreNames) {
			const name = rawName.trim();
			if (!name) continue;

			const existing = await tx.select().from(genres).where(eq(genres.name, name)).limit(1);
			if (existing.length > 0) {
				genreIds.push(existing[0].id);
				continue;
			}

			const result = await tx.insert(genres).values({ name }).returning({ id: genres.id });
			genreIds.push(result[0].id);
		}

		const existingMovies = await tx.select().from(movies).where(eq(movies.tmdbId, payload.tmdbId)).limit(1);
		const existingMovie = existingMovies[0];
		const movieId = existingMovie?.id ?? randomUUID();

		const movieData = {
			id: movieId,
			tmdbId: payload.tmdbId,
			title: payload.title,
			overview: payload.overview,
			posterPath: payload.posterPath,
			backdropPath: payload.backdropPath,
			releaseDate: payload.releaseDate,
			rating: payload.rating,
			durationMinutes: payload.durationMinutes,
			is4K: payload.is4K ? 1 : 0,
			isHD: payload.isHD ? 1 : 0,
			collectionId: payload.collectionId ?? (existingMovie?.collectionId || null),
			updatedAt: Date.now()
		};

		if (existingMovie) {
			await tx.update(movies).set(movieData).where(eq(movies.tmdbId, payload.tmdbId));
		} else {
			await tx.insert(movies).values({ ...movieData, createdAt: Date.now() });
		}

		await tx.delete(moviesGenres).where(eq(moviesGenres.movieId, movieId));
		for (const genreId of genreIds) {
			await tx.insert(moviesGenres).values({ movieId, genreId }).onConflictDoNothing();
		}

		// Since we are inside a transaction, we should use a load function that also uses tx 
		// but for simplicity here we'll just return the final result after transaction
		// Actually, mapRowsToRecords uses 'db' which might not see transaction yet?
		// Better to just return the results manually or use tx in mapping.
		// For now, let's just finish the transaction and load after.
		return movieId;
	}).then(id => loadMovieById(id));
};

export const setMovieCollection = async (movieId: string, collectionId: number | null) => {
	await db.update(movies).set({ collectionId }).where(eq(movies.id, movieId));
};

export const createCollection = async (name: string, description: string | null = null): Promise<number> => {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	const existing = await db.select().from(collections).where(eq(collections.slug, slug)).limit(1);
	if (existing.length > 0) {
		return existing[0].id;
	}

	const result = await db.insert(collections).values({ name, slug, description }).returning({ id: collections.id });
	return result[0].id;
};

export const countMovies = async (): Promise<number> => {
	const result = await db.select({ count: drizzleCount() }).from(movies);
	return result[0].count;
};
