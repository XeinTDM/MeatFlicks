import { randomUUID } from 'node:crypto';
import sqlite from '$lib/server/db';
import type { GenreRecord, MovieRecord, MovieRow } from '$lib/server/db';
import { MOVIE_COLUMNS, mapRowsToRecords } from '$lib/server/db/movie-select';

const selectMovieByIdStatement = sqlite.prepare(
	`SELECT ${MOVIE_COLUMNS} FROM movies m WHERE m.id = ? LIMIT 1`
);

const selectMovieByTmdbStatement = sqlite.prepare(
	`SELECT ${MOVIE_COLUMNS} FROM movies m WHERE m.tmdbId = ? LIMIT 1`
);

const selectGenreByNameStatement = sqlite.prepare(
	"SELECT id, name FROM genres WHERE name = ?"
);

const insertGenreStatement = sqlite.prepare(
	"INSERT INTO genres (name) VALUES (?)"
);

const deleteMovieGenresStatement = sqlite.prepare(
	"DELETE FROM movies_genres WHERE movieId = ?"
);

const insertMovieGenreStatement = sqlite.prepare(
	"INSERT OR IGNORE INTO movies_genres (movieId, genreId) VALUES (?, ?)"
);

const insertMovieStatement = sqlite.prepare(
	`INSERT INTO movies (
		id,
		tmdbId,
		title,
		overview,
		posterPath,
		backdropPath,
		releaseDate,
		rating,
		durationMinutes,
		is4K,
		isHD,
		collectionId
	) VALUES (
		@id,
		@tmdbId,
		@title,
		@overview,
		@posterPath,
		@backdropPath,
		@releaseDate,
		@rating,
		@durationMinutes,
		@is4K,
		@isHD,
		@collectionId
	)`
);

const updateMovieStatement = sqlite.prepare(
	`UPDATE movies SET
		title = @title,
		overview = @overview,
		posterPath = @posterPath,
		backdropPath = @backdropPath,
		releaseDate = @releaseDate,
		rating = @rating,
		durationMinutes = @durationMinutes,
		is4K = @is4K,
		isHD = @isHD,
		collectionId = COALESCE(@collectionId, collectionId)
	WHERE tmdbId = @tmdbId`
);

const updateMovieCollectionStatement = sqlite.prepare(
	"UPDATE movies SET collectionId = @collectionId WHERE id = @movieId"
);

const insertCollectionStatement = sqlite.prepare(
	"INSERT INTO collections (name, slug, description) VALUES (?, ?, ?)"
);

const selectCollectionBySlugStatement = sqlite.prepare(
	"SELECT id FROM collections WHERE slug = ?"
);

const countMoviesStatement = sqlite.prepare<[], { count: number }>(
	"SELECT COUNT(*) as count FROM movies"
);

const loadMovieRow = (row: MovieRow | undefined): MovieRecord | null => {
	if (!row) {
		return null;
	}

	const [movie] = mapRowsToRecords([row]);
	return movie ?? null;
};

export const loadMovieById = (id: string): MovieRecord | null => {
	return loadMovieRow(selectMovieByIdStatement.get(id) as MovieRow | undefined);
};

export const loadMovieByTmdb = (tmdbId: number): MovieRecord | null => {
	return loadMovieRow(selectMovieByTmdbStatement.get(tmdbId) as MovieRow | undefined);
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

export const upsertMovieWithGenres = sqlite.transaction((payload: UpsertMoviePayload) => {
	const genreIds: number[] = [];
	for (const rawName of payload.genreNames) {
		const name = rawName.trim();
		if (!name) continue;
		const existing = selectGenreByNameStatement.get(name) as GenreRecord | undefined;
		if (existing) {
			genreIds.push(existing.id);
			continue;
		}
		const runResult = insertGenreStatement.run(name);
		genreIds.push(Number(runResult.lastInsertRowid));
	}

	const existingRow = selectMovieByTmdbStatement.get(payload.tmdbId) as MovieRow | undefined;
	const movieId = existingRow?.id ?? randomUUID();

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
		collectionId: payload.collectionId ?? null
	};

	if (existingRow) {
		updateMovieStatement.run(movieData);
	} else {
		insertMovieStatement.run(movieData);
	}

	deleteMovieGenresStatement.run(movieId);
	for (const genreId of genreIds) {
		insertMovieGenreStatement.run(movieId, genreId);
	}

	return loadMovieById(movieId);
});

export const setMovieCollection = (movieId: string, collectionId: number | null) => {
	updateMovieCollectionStatement.run({ movieId, collectionId });
};

export const createCollection = (name: string, description: string | null = null): number => {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	const existing = selectCollectionBySlugStatement.get(slug) as { id: number } | undefined;
	if (existing) {
		return existing.id;
	}

	const result = insertCollectionStatement.run(name, slug, description ?? null);
	return Number(result.lastInsertRowid);
};

export const countMovies = (): number => {
	const row = countMoviesStatement.get();
	return row?.count ?? 0;
};
