import sqlite from "./client";
import { mapMovieRows } from "./mappers";
import type {
	GenreRecord,
	MovieRecord,
	MovieRow,
	MovieSummary
} from "./types";

type MovieGenreRow = { movieId: string; id: number; name: string };

export const MOVIE_COLUMNS = `
	m.numericId as numericId,
	m.id as id,
	m.tmdbId as tmdbId,
	m.title as title,
	m.overview as overview,
	m.posterPath as posterPath,
	m.backdropPath as backdropPath,
	m.releaseDate as releaseDate,
	m.rating as rating,
	m.durationMinutes as durationMinutes,
	m.is4K as is4K,
	m.isHD as isHD,
	m.collectionId as collectionId,
	m.createdAt as createdAt,
	m.updatedAt as updatedAt
`;

export const MOVIE_ORDER_BY = `
	ORDER BY
		(m.rating IS NULL) ASC,
		m.rating DESC,
		(m.releaseDate IS NULL) ASC,
		m.releaseDate DESC,
		m.title COLLATE NOCASE ASC
`;

export const fetchGenresForMovies = (ids: string[]): Map<string, GenreRecord[]> => {
	const lookup = new Map<string, GenreRecord[]>();

	if (ids.length === 0) {
		return lookup;
	}

	const placeholders = ids.map(() => "?").join(", ");
	const statement = sqlite.prepare(
		`SELECT mg.movieId as movieId, g.id as id, g.name as name
		FROM movies_genres mg
		JOIN genres g ON g.id = mg.genreId
		WHERE mg.movieId IN (${placeholders})
		ORDER BY g.name COLLATE NOCASE ASC`
	);

	const rows = statement.all(...ids) as MovieGenreRow[];
	for (const row of rows) {
		if (!lookup.has(row.movieId)) {
			lookup.set(row.movieId, []);
		}
		lookup.get(row.movieId)!.push({ id: row.id, name: row.name });
	}

	return lookup;
};

export const mapRowsToRecords = (rows: MovieRow[]): MovieRecord[] => {
	if (rows.length === 0) {
		return [];
	}

	const ids = rows.map((row) => row.id);
	const genres = fetchGenresForMovies(ids);
	return mapMovieRows(rows, genres);
};

export const toMovieSummary = (movie: MovieRecord): MovieSummary => {
	const { numericId, createdAt, updatedAt, ...rest } = movie;
	return rest;
};

export const mapRowsToSummaries = (rows: MovieRow[]): MovieSummary[] => {
	return mapRowsToRecords(rows).map(toMovieSummary);
};
