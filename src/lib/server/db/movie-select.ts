import { db } from './client';
import { movies, moviesGenres, genres } from './schema';
import { eq, inArray, asc } from 'drizzle-orm';
import { mapMovieRows } from './mappers';
import type { GenreRecord, MovieRecord, MovieRow, MovieSummary } from './types';

export const fetchGenresForMovies = async (ids: string[]): Promise<Map<string, GenreRecord[]>> => {
	const lookup = new Map<string, GenreRecord[]>();

	if (ids.length === 0) {
		return lookup;
	}

	const rows = await db
		.select({
			movieId: moviesGenres.movieId,
			id: genres.id,
			name: genres.name
		})
		.from(moviesGenres)
		.innerJoin(genres, eq(genres.id, moviesGenres.genreId))
		.where(inArray(moviesGenres.movieId, ids))
		.orderBy(asc(genres.name));

	for (const row of rows) {
		if (!lookup.has(row.movieId)) {
			lookup.set(row.movieId, []);
		}
		lookup.get(row.movieId)!.push({ id: row.id, name: row.name });
	}

	return lookup;
};

export const mapRowsToRecords = async (rows: MovieRow[]): Promise<MovieRecord[]> => {
	if (rows.length === 0) {
		return [];
	}

	const ids = rows.map((row) => row.id);
	const genresLookup = await fetchGenresForMovies(ids);
	return mapMovieRows(rows, genresLookup);
};

export const toMovieSummary = (movie: MovieRecord): MovieSummary => {
	const { numericId, createdAt, updatedAt, ...rest } = movie;
	return rest;
};

export const mapRowsToSummaries = async (rows: MovieRow[]): Promise<MovieSummary[]> => {
	const records = await mapRowsToRecords(rows);
	return records.map(toMovieSummary);
};

// These constants are kept for backward compatibility if needed,
// but Drizzle query builder is preferred.
export const MOVIE_COLUMNS = '*';
export const MOVIE_ORDER_BY = '';
