import { json, type RequestHandler } from "@sveltejs/kit";
import sqlite from "$lib/server/db";
import type { MovieRow } from "$lib/server/db";
import { MOVIE_COLUMNS, MOVIE_ORDER_BY, mapRowsToSummaries } from "$lib/server/db/movie-select";
import { buildCacheKey, CACHE_TTL_SHORT_SECONDS, withCache } from "$lib/server/cache";
import { createHash } from "node:crypto";

const DEFAULT_LIMIT = 100;

const normalizeQuery = (value: string) => value.trim();

const parseLimit = (value: string | null): number => {
	if (!value) {
		return DEFAULT_LIMIT;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_LIMIT;
	}

	return Math.min(parsed, DEFAULT_LIMIT);
};

const sanitizeForFts = (term: string): string => {
	const cleaned = term
		.toLowerCase()
		.replace(/[^a-z0-9\s]/gi, " ")
		.split(/\s+/)
		.filter(Boolean);

	if (cleaned.length === 0) {
		return "";
	}

	return cleaned.map((token) => `${token}*`).join(" ");
};

const searchStatement = sqlite.prepare(
	`SELECT ${MOVIE_COLUMNS}
	FROM movie_fts mf
	JOIN movies m ON m.numericId = mf.rowid
	WHERE mf MATCH ?
	ORDER BY bm25(mf) ASC,
		(m.rating IS NULL) ASC,
		m.rating DESC,
		(m.releaseDate IS NULL) ASC,
		m.releaseDate DESC,
		m.title COLLATE NOCASE ASC
	LIMIT ?`
);

const likeFallbackStatement = sqlite.prepare(
	`SELECT ${MOVIE_COLUMNS}
	FROM movies m
	WHERE m.title LIKE ? OR m.overview LIKE ?
	${MOVIE_ORDER_BY}
	LIMIT ?`
);

export const GET: RequestHandler = async ({ url }) => {
	const searchParam = url.searchParams.get("q");

	if (!searchParam) {
		return json({ error: 'Query parameter "q" is required' }, { status: 400 });
	}

	const query = normalizeQuery(searchParam);

	if (query.length === 0) {
		return json({ error: 'Query parameter "q" cannot be empty' }, { status: 400 });
	}

	const limit = parseLimit(url.searchParams.get("limit"));
	const hash = createHash("sha1").update(query.toLowerCase()).digest("hex");
	const cacheKey = buildCacheKey("search", "movies", hash, limit);

	try {
		const movies = await withCache(cacheKey, CACHE_TTL_SHORT_SECONDS, async () => {
			const ftsQuery = sanitizeForFts(query);
			let rows: MovieRow[] = [];

			if (ftsQuery) {
				rows = searchStatement.all(ftsQuery, limit) as MovieRow[];
			}

			if (rows.length === 0) {
				const likeTerm = `%${query.replace(/%/g, "%%")}%`;
				rows = likeFallbackStatement.all(likeTerm, likeTerm, limit) as MovieRow[];
			}

			return mapRowsToSummaries(rows);
		});

		return json(movies);
	} catch (error) {
		console.error("Error searching movies:", error);
		return json({ error: "Internal Server Error" }, { status: 500 });
	}
};
