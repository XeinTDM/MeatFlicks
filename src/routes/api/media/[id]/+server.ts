import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { media } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { MediaRecord, MediaRow } from '$lib/server/db';
import { mapRowsToRecords } from '$lib/server/db/movie-select';
import {
	CACHE_TTL_LONG_SECONDS,
	buildCacheKey,
	setCachedValue,
	withCache
} from '$lib/server/cache';
import {
	fetchTmdbMovieExtras,
	fetchTmdbTvDetails,
	lookupTmdbIdByImdbId
} from '$lib/server/services/tmdb.service';
import { errorHandler, NotFoundError, ValidationError, UnauthorizedError, getEnv } from '$lib/server';
import { z } from 'zod';
import {
	validatePathParams,
	validateQueryParams,
	movieIdentifierSchema,
	queryModeSchema
} from '$lib/server/validation';
import { mediaSyncService } from '$lib/server/services/media-sync.service';

const clampTtl = (value: number): number => {
	const min = 300;
	const max = 1800;
	if (!Number.isFinite(value)) {
		return CACHE_TTL_LONG_SECONDS;
	}
	return Math.min(Math.max(value, min), max);
};

const MOVIE_CACHE_TTL_SECONDS = clampTtl(
	Number.parseInt(getEnv('CACHE_TTL_MOVIE', CACHE_TTL_LONG_SECONDS.toString()) ?? '', 10) ||
		CACHE_TTL_LONG_SECONDS
);

const detectQueryMode = (identifier: string): 'id' | 'tmdb' | 'imdb' => {
	if (/^tt\d{7,}$/i.test(identifier)) {
		return 'imdb';
	}
	return 'id';
};

type MediaLookup = { kind: 'id'; value: string } | { kind: 'tmdb'; value: number };

const loadMedia = async (lookup: MediaLookup): Promise<MediaRecord | null> => {
	let rows: any[] = [];
	if (lookup.kind === 'id') {
		rows = await db.select().from(media).where(eq(media.id, lookup.value)).limit(1);
	} else {
		rows = await db.select().from(media).where(eq(media.tmdbId, lookup.value)).limit(1);
	}

	if (rows.length === 0) {
		return null;
	}

	const [record] = await mapRowsToRecords(rows as MediaRow[]);
	return record ?? null;
};

async function cacheMediaVariants(
	record: MediaRecord,
	skipKey?: string,
	additionalKeys: string[] = []
) {
	const keys = new Set<string>();

	if (record.id) {
		keys.add(buildCacheKey('media', 'id', record.id));
	}

	if (isValidTmdbId(record.tmdbId)) {
		keys.add(buildCacheKey('media', 'tmdb', record.tmdbId));
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
		Array.from(keys).map((key) => setCachedValue(key, record, MOVIE_CACHE_TTL_SECONDS))
	);
}

async function fetchMediaWithCache(
	cacheKey: string,
	lookup: MediaLookup,
	extraKeySelector?: (media: MediaRecord) => string[]
): Promise<MediaRecord | null> {
	return withCache<MediaRecord | null>(cacheKey, MOVIE_CACHE_TTL_SECONDS, async () => {
		const record = await loadMedia(lookup);

		if (record) {
			const extraKeys = extraKeySelector ? extraKeySelector(record) : [];
			await cacheMediaVariants(record, cacheKey, extraKeys);
		}

		return record;
	});
}

async function resolveMediaByIdentifier(identifier: string, queryMode: 'id' | 'tmdb' | 'imdb') {
	switch (queryMode) {
		case 'tmdb': {
			const tmdbId = Number.parseInt(identifier, 10);
			if (!Number.isFinite(tmdbId)) {
				throw new ValidationError('Invalid TMDB id provided.');
			}

			const record = await fetchMediaWithCache(
				buildCacheKey('media', 'tmdb', tmdbId),
				{ kind: 'tmdb', value: tmdbId },
				(m) => [buildCacheKey('media', 'id', m.id)]
			);

			return { media: record, tmdbId } as const;
		}
		case 'imdb': {
			const tmdbId = await lookupTmdbIdByImdbId(identifier);
			if (!tmdbId) {
				return { media: null, tmdbId: null } as const;
			}

			const record = await fetchMediaWithCache(
				buildCacheKey('media', 'tmdb', tmdbId),
				{ kind: 'tmdb', value: tmdbId },
				(m) => [buildCacheKey('media', 'id', m.id)]
			);

			return { media: record, tmdbId } as const;
		}
		case 'id':
		default: {
			const cacheKey = buildCacheKey('media', 'id', identifier);
			const record = await fetchMediaWithCache(
				cacheKey,
				{ kind: 'id', value: identifier },
				(m) =>
					isValidTmdbId(m.tmdbId) ? [buildCacheKey('media', 'tmdb', m.tmdbId)] : []
			);

			return { media: record, tmdbId: record?.tmdbId ?? null } as const;
		}
	}
}

const isValidTmdbId = (value: unknown): value is number => {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		if (!locals.user) {
			throw new UnauthorizedError('Unauthorized access to media API');
		}

		const pathParams = validatePathParams(movieIdentifierSchema, { id: params.id ?? '' });
		const queryParams = validateQueryParams(
			z.object({ by: queryModeSchema.optional() }),
			url.searchParams
		);

		const movieIdentifier = pathParams.id;
		const queryMode = queryParams.by ?? detectQueryMode(movieIdentifier);

		let { media: record, tmdbId } = await resolveMediaByIdentifier(movieIdentifier, queryMode);
		const effectiveTmdbId = isValidTmdbId(tmdbId)
			? tmdbId
			: queryMode === 'tmdb'
				? Number.parseInt(movieIdentifier, 10)
				: null;

		// 1. If not found in DB at all, perform a BLOCKING sync once
		if (!record && isValidTmdbId(effectiveTmdbId)) {
			console.log(`[API] Media not found, performing initial sync for TMDB ID: ${effectiveTmdbId}`);
			// Try regular movie first, then TV if it failed or returned nothing
			try {
				await mediaSyncService.performSync(effectiveTmdbId, 'movie');
			} catch (e) {
				await mediaSyncService.performSync(effectiveTmdbId, 'tv');
			}
			
			// Reload from DB
			record = await loadMedia({ kind: 'tmdb', value: effectiveTmdbId });
		}

		if (!record) {
			throw new NotFoundError('Media not found');
		}

		// 2. If record is found but stale, trigger NON-BLOCKING background sync
		if (isValidTmdbId(record.tmdbId) && mediaSyncService.needsSync(record.updatedAt)) {
			mediaSyncService.scheduleSync(record.tmdbId, record.mediaType as any, 'low');
		}

		// 3. Fetch extras (Blocking for now as it contains cast/production info often needed for details page)
		// Optimization: withCache should make this very fast for repeat hits
		let extras = null;
		if (isValidTmdbId(record.tmdbId)) {
			try {
				if (record.mediaType === 'tv') {
					const tvExtras = await fetchTmdbTvDetails(record.tmdbId);
					extras = {
						...tvExtras,
						releaseDate: tvExtras.firstAirDate,
						runtime: tvExtras.episodeRuntimes?.[0] ?? null
					};
				} else {
					extras = await fetchTmdbMovieExtras(record.tmdbId);
				}
			} catch (error) {
				console.log(`[API] Failed to fetch TMDB extras for ${record.tmdbId}, using DB data only`);
			}
		}

		const payload = {
			...record,
			releaseDate: record.releaseDate ?? (extras?.releaseDate ? new Date(extras.releaseDate) : null),
			durationMinutes: record.durationMinutes ?? extras?.runtime ?? null,
			imdbId: extras?.imdbId ?? record.imdbId ?? null,
			cast: (extras?.cast ?? [])
				.filter((c: any) => c.character && c.character.trim())
				.map((c: any) => ({ ...c, character: c.character! })),
			trailerUrl: extras?.trailerUrl ?? record.trailerUrl ?? null,
			productionCompanies: extras?.productionCompanies ?? [],
			productionCountries: extras?.productionCountries ?? [],
			voteCount: extras?.voteCount ?? null
		};

		return json(payload);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
