import { json, type RequestHandler } from "@sveltejs/kit";
import sqlite from "$lib/server/db";
import type { GenreRecord, MovieRecord, MovieRow } from "$lib/server/db";
import {
	MOVIE_COLUMNS,
	mapRowsToRecords
} from "$lib/server/db/movie-select";
import {
	CACHE_TTL_LONG_SECONDS,
	buildCacheKey,
	setCachedValue,
	withCache
} from "$lib/server/cache";
import {
	fetchTmdbMovieDetails,
	fetchTmdbMovieExtras,
	lookupTmdbIdByImdbId
} from "$lib/server/services/tmdb.service";
import { randomUUID } from "node:crypto";

const clampTtl = (value: number): number => {
	const min = 300;
	const max = 1800;
	if (!Number.isFinite(value)) {
		return CACHE_TTL_LONG_SECONDS;
	}
	return Math.min(Math.max(value, min), max);
};

const MOVIE_CACHE_TTL_SECONDS = clampTtl(
	Number.parseInt(process.env.CACHE_TTL_MOVIE ?? "", 10) || CACHE_TTL_LONG_SECONDS
);

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
		NULL
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
		isHD = @isHD
	WHERE tmdbId = @tmdbId`
);

type MovieLookup = { kind: "id"; value: string } | { kind: "tmdb"; value: number };

const loadMovie = (lookup: MovieLookup): MovieRecord | null => {
	const row =
		lookup.kind === "id"
			? (selectMovieByIdStatement.get(lookup.value) as MovieRow | undefined)
			: (selectMovieByTmdbStatement.get(lookup.value) as MovieRow | undefined);

	if (!row) {
		return null;
	}

	const [movie] = mapRowsToRecords([row]);
	return movie ?? null;
};

async function cacheMovieVariants(
	movie: MovieRecord,
	skipKey?: string,
	additionalKeys: string[] = []
) {
	const keys = new Set<string>();

	if (movie.id) {
		keys.add(buildCacheKey("movie", "id", movie.id));
	}

	if (isValidTmdbId(movie.tmdbId)) {
		keys.add(buildCacheKey("movie", "tmdb", movie.tmdbId));
	}

	for (const key of additionalKeys) {
		if (key) {
			keys.add(key);
		}
	}

	if (skipKey) {
		keys.delete(skipKey);
	}

	if (keys.size === 0) {
		return;
	}

	await Promise.all(
		Array.from(keys).map((key) => setCachedValue(key, movie, MOVIE_CACHE_TTL_SECONDS))
	);
}

async function fetchMovieWithCache(
	cacheKey: string,
	lookup: MovieLookup,
	extraKeySelector?: (movie: MovieRecord) => string[]
): Promise<MovieRecord | null> {
	return withCache<MovieRecord | null>(cacheKey, MOVIE_CACHE_TTL_SECONDS, async () => {
		const movie = loadMovie(lookup);

		if (movie) {
			const extraKeys = extraKeySelector ? extraKeySelector(movie) : [];
			await cacheMovieVariants(movie, cacheKey, extraKeys);
		}

		return movie;
	});
}

async function resolveMovieByIdentifier(identifier: string, queryMode: "id" | "tmdb" | "imdb") {
	switch (queryMode) {
		case "tmdb": {
			const tmdbId = Number.parseInt(identifier, 10);
			if (!Number.isFinite(tmdbId)) {
				throw new Error("Invalid TMDB id provided.");
			}

			const movie = await fetchMovieWithCache(
				buildCacheKey("movie", "tmdb", tmdbId),
				{ kind: "tmdb", value: tmdbId },
				(record) => [buildCacheKey("movie", "id", record.id)]
			);

			return { movie, tmdbId } as const;
		}
		case "imdb": {
			const tmdbId = await lookupTmdbIdByImdbId(identifier);
			if (!tmdbId) {
				return { movie: null, tmdbId: null } as const;
			}

			const movie = await fetchMovieWithCache(
				buildCacheKey("movie", "tmdb", tmdbId),
				{ kind: "tmdb", value: tmdbId },
				(record) => [buildCacheKey("movie", "id", record.id)]
			);

			return { movie, tmdbId } as const;
		}
		case "id":
		default: {
			const cacheKey = buildCacheKey("movie", "id", identifier);
			const movie = await fetchMovieWithCache(
				cacheKey,
				{ kind: "id", value: identifier },
				(record) =>
					isValidTmdbId(record.tmdbId) ? [buildCacheKey("movie", "tmdb", record.tmdbId)] : []
			);

			return { movie, tmdbId: movie?.tmdbId ?? null } as const;
		}
	}
}

const upsertMovieWithGenres = sqlite.transaction(
	(payload: {
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
	}) => {
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
			isHD: payload.isHD ? 1 : 0
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

		const refreshed = selectMovieByIdStatement.get(movieId) as MovieRow | undefined;
		if (!refreshed) {
			return null;
		}

		const [movie] = mapRowsToRecords([refreshed]);
		return movie ?? null;
	}
);

const isValidTmdbId = (value: unknown): value is number => {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
};

type MovieWithDetails = MovieRecord & {
	imdbId: string | null;
	cast: { id: number; name: string; character: string }[];
	trailerUrl: string | null;
};

async function resolveFallbackMovie(tmdbId: number): Promise<MovieWithDetails | null> {
	if (!isValidTmdbId(tmdbId)) {
		return null;
	}

	const details = await fetchTmdbMovieDetails(tmdbId);

	if (!details.found) {
		return null;
	}

	const releaseDate = details.releaseDate ? details.releaseDate.trim() : null;
	const rating = details.rating ?? null;
	const durationMinutes = details.runtime ?? null;
	const genreNames = Array.from(
		new Set(
			details.genres
				.map((genre) => (typeof genre.name === "string" ? genre.name.trim() : ""))
				.filter(Boolean)
		)
	);

	const movie = upsertMovieWithGenres({
		tmdbId,
		title: details.title ?? "Untitled",
		overview: details.overview ?? null,
		posterPath: details.posterPath ?? null,
		backdropPath: details.backdropPath ?? null,
		releaseDate,
		rating,
		durationMinutes,
		is4K: false,
		isHD: true,
		genreNames
	});

	if (!movie) {
		return null;
	}

	await cacheMovieVariants(movie);

	return {
		...movie,
		imdbId: details.imdbId,
		cast: details.cast,
		trailerUrl: details.trailerUrl
	};
}

export const GET: RequestHandler = async ({ params, url }) => {
	const movieIdentifier = params.id;
	const queryModeParam = url.searchParams.get("by");
	const queryMode = queryModeParam === "tmdb" || queryModeParam === "imdb" ? queryModeParam : "id";

	if (!movieIdentifier) {
		return json({ error: "Movie identifier is required." }, { status: 400 });
	}

	try {
		const { movie, tmdbId } = await resolveMovieByIdentifier(movieIdentifier, queryMode);
		const effectiveTmdbId = isValidTmdbId(tmdbId)
			? tmdbId
			: queryMode === "tmdb"
				? Number.parseInt(movieIdentifier, 10)
				: null;

		if (!movie || !isValidTmdbId(effectiveTmdbId)) {
			const fallbackMovie = isValidTmdbId(effectiveTmdbId)
				? await resolveFallbackMovie(effectiveTmdbId)
				: null;

			if (!fallbackMovie) {
				return json({ message: "Movie not found" }, { status: 404 });
			}

			return json(fallbackMovie);
		}

		const extras = await fetchTmdbMovieExtras(effectiveTmdbId);

		const payload = {
			...movie,
			releaseDate: movie.releaseDate ?? (extras.releaseDate ? new Date(extras.releaseDate) : null),
			durationMinutes: movie.durationMinutes ?? extras.runtime ?? null,
			imdbId: extras.imdbId,
			cast: extras.cast,
			trailerUrl: extras.trailerUrl
		};

		return json(payload);
	} catch (error) {
		console.error("Error fetching movie with identifier " + movieIdentifier + ":", error);
		return json(
			{ error: "Failed to fetch movie with identifier " + movieIdentifier },
			{ status: 500 }
		);
	}
};
