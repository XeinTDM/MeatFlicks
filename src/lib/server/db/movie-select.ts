import { db } from './client';
import { moviesGenres, genres } from './schema';
import { inArray } from 'drizzle-orm';
import { mapMovieRows } from './mappers';
import type { GenreRecord, MovieRecord, MovieRow, MovieSummary } from './types';

let globalGenreCache: Map<number, { id: number; name: string }> | null = null;

const getGenreCache = async () => {
	if (globalGenreCache) return globalGenreCache;
	const rows = await db.select().from(genres);
	globalGenreCache = new Map(rows.map((r) => [r.id, r]));
	return globalGenreCache;
};

export const fetchGenresForMovies = async (ids: string[]): Promise<Map<string, GenreRecord[]>> => {
	const lookup = new Map<string, GenreRecord[]>();

	if (ids.length === 0) {
		return lookup;
	}

	const [rows, genreCache] = await Promise.all([
		db
			.select({
				movieId: moviesGenres.movieId,
				genreId: moviesGenres.genreId
			})
			.from(moviesGenres)
			.where(inArray(moviesGenres.movieId, ids)),
		getGenreCache()
	]);

	for (const row of rows) {
		const genre = genreCache.get(row.genreId);
		if (!genre) continue;

		if (!lookup.has(row.movieId)) {
			lookup.set(row.movieId, []);
		}
		lookup.get(row.movieId)!.push(genre);
	}

	for (const genreList of lookup.values()) {
		genreList.sort((a, b) => a.name.localeCompare(b.name));
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
	const { ...rest } = movie;
	return rest;
};

export const mapRowsToSummaries = async (rows: MovieRow[]): Promise<MovieSummary[]> => {
	const records = await mapRowsToRecords(rows);
	return records.map(toMovieSummary);
};

export const MOVIE_COLUMNS = '*';
export const MOVIE_ORDER_BY = '';
