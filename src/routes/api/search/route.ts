import { json, type RequestHandler } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { movies } from "$lib/server/db/schema";
import { sql } from "drizzle-orm";
import type { MovieRow } from "$lib/server/db";
import { mapRowsToSummaries } from "$lib/server/db/movie-select";
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
		const results = await withCache(cacheKey, CACHE_TTL_SHORT_SECONDS, async () => {
			const ftsQuery = sanitizeForFts(query);
			let rows: any[] = [];
			let ftsFailed = false;

			if (ftsQuery) {
				try {
					// Raw SQL via Drizzle for FTS5
					const searchSql = sql`
						SELECT m.*
						FROM movie_fts mf
						JOIN movies m ON m.numericId = mf.rowid
						WHERE mf MATCH ${ftsQuery}
						ORDER BY bm25(mf) ASC,
							(m.rating IS NULL) ASC,
							m.rating DESC,
							(m.releaseDate IS NULL) ASC,
							m.releaseDate DESC,
							m.title COLLATE NOCASE ASC
						LIMIT ${limit}
					`;
					// Libsql return format might need adjustment or use db.all
					rows = await db.all(searchSql);
				} catch (err) {
					console.warn('[search] FTS failed (table might be missing), falling back to LIKE:', err);
					ftsFailed = true;
				}
			}

			if (rows.length === 0 || ftsFailed) {
				const likeTerm = `%${query.replace(/%/g, "%%")}%`;
				const fallbackSql = sql`
					SELECT *
					FROM movies m
					WHERE m.title LIKE ${likeTerm} OR m.overview LIKE ${likeTerm}
					ORDER BY
						(m.rating IS NULL) ASC,
						m.rating DESC,
						(m.releaseDate IS NULL) ASC,
						m.releaseDate DESC,
						m.title COLLATE NOCASE ASC
					LIMIT ${limit}
				`;
				rows = await db.all(fallbackSql);
			}

			return await mapRowsToSummaries(rows as MovieRow[]);
		});

		return json(results);
	} catch (error) {
		console.error("Error searching movies:", error);
		return json({ error: "Internal Server Error" }, { status: 500 });
	}
};
