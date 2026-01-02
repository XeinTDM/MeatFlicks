import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { movies, genres, moviesGenres, collections } from '$lib/server/db/schema';
import { eq, and, count as drizzleCount, inArray } from 'drizzle-orm';
import type { MovieRecord, MovieRow } from '$lib/server/db';
import { mapRowsToRecords } from '$lib/server/db/movie-select';
import { syncMovieCast, syncMovieCrew } from '$lib/server/services/person-sync.service';
import { validateMovieData } from './validation';

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
): Promise<MovieRecord | null> => {
	const results = await bulkUpsertMovies([payload]);
	return results[0] ?? null;
};

export const bulkUpsertMovies = async (payloads: UpsertMoviePayload[]): Promise<MovieRecord[]> => {
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
			}

			const tmdbIds = payloads.map((p) => p.tmdbId);
			const existingMovies = await tx
				.select()
				.from(movies)
				.where(inArray(movies.tmdbId, tmdbIds));

			const movieMap = new Map();
			for (const m of existingMovies) {
				const key = `${m.tmdbId}:${m.mediaType}`;
				movieMap.set(key, m);
			}

			const results: MovieRecord[] = [];
			const movieUpserts: any[] = [];
			const movieInserts: any[] = [];
			const genresToAssign: { movieId: string; genreId: number }[] = [];

			for (const payload of payloads) {
				validateMovieData(payload);

				const mediaType = payload.mediaType || 'movie';
				const key = `${payload.tmdbId}:${mediaType}`;
				const existingMovie = movieMap.get(key);
				const movieId = existingMovie?.id ?? randomUUID();

				const movieData: any = {
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
					collectionId: payload.collectionId ?? (existingMovie?.collectionId || null),
					mediaType: mediaType,
					imdbId: payload.imdbId ?? (existingMovie?.imdbId || null),
					trailerUrl: payload.trailerUrl ?? (existingMovie?.trailerUrl || null),
					updatedAt: Date.now()
				};

				if (existingMovie) {
					await tx.update(movies).set(movieData).where(eq(movies.id, existingMovie.id));
				} else {
					movieData.id = movieId;
					movieData.createdAt = Date.now();
					await tx.insert(movies).values(movieData);
				}

				const payloadGenreIds = payload.genreNames
					.map((n) => genreMap.get(n.trim()))
					.filter((id): id is number => id !== undefined);

				for (const genreId of payloadGenreIds) {
					genresToAssign.push({ movieId, genreId });
				}

				results.push({
					...movieData,
					id: movieId,
					createdAt: existingMovie?.createdAt ?? movieData.createdAt ?? movieData.updatedAt
				} as unknown as MovieRecord);
			}

			const movieIds = results.map((r) => r.id);
			if (movieIds.length > 0) {
				await tx.delete(moviesGenres).where(inArray(moviesGenres.movieId, movieIds));
			}

			if (genresToAssign.length > 0) {
				await tx.insert(moviesGenres).values(genresToAssign).onConflictDoNothing();
			}

			return results;
		})
		.then(async (syncedMovies) => {
			for (const movie of syncedMovies) {
				try {
					await syncMovieCast(movie.id, movie.tmdbId!, movie.mediaType as any);
					await syncMovieCrew(movie.id, movie.tmdbId!, movie.mediaType as any);
				} catch (error) {
					console.warn(`Failed to sync person data for movie ${movie.id}:`, error);
				}
			}
			return syncedMovies;
		});
};

export const setMovieCollection = async (movieId: string, collectionId: number | null) => {
	await db.update(movies).set({ collectionId }).where(eq(movies.id, movieId));
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
	const result = await db.select({ count: drizzleCount() }).from(movies);
	return result[0].count;
};
