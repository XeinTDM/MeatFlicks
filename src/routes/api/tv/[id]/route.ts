import { json, type RequestHandler } from '@sveltejs/kit';
import { buildCacheKey, CACHE_TTL_LONG_SECONDS, withCache } from '$lib/server/cache';
import { fetchTmdbTvDetails, lookupTmdbIdByImdbId } from '$lib/server/services/tmdb.service';
import type { TmdbTvDetails } from '$lib/server/services/tmdb.service';
import { z } from 'zod';
import { validatePathParams, validateQueryParams, queryModeSchema } from '$lib/server/validation';
import { errorHandler } from '$lib/server';

const tvIdentifierSchema = z.object({
	id: z.string().min(1, 'TV identifier is required')
});

const tvQueryParamsSchema = z.object({
	by: queryModeSchema.optional()
});

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		// Validate path parameters
		const pathParams = validatePathParams(tvIdentifierSchema, params);

		// Validate query parameters
		const queryParams = validateQueryParams(tvQueryParamsSchema, url.searchParams);

		const identifier = pathParams.id;
		const queryMode = queryParams.by ?? (identifier.startsWith('tt') ? 'imdb' : 'tmdb');

		let tmdbId: number | null = null;

		if (queryMode === 'imdb') {
			tmdbId = await lookupTmdbIdByImdbId(identifier);
			if (!tmdbId) {
				return json({ message: 'TV show not found' }, { status: 404 });
			}
		} else {
			const parsed = Number.parseInt(identifier, 10);
			if (!Number.isFinite(parsed) || parsed <= 0) {
				return json({ error: 'A valid TMDB id is required.' }, { status: 400 });
			}
			tmdbId = parsed;
		}

		const cacheKey = buildCacheKey('tv', tmdbId);
		const details = await withCache<TmdbTvDetails>(cacheKey, CACHE_TTL_LONG_SECONDS, () =>
			fetchTmdbTvDetails(tmdbId!)
		);

		if (!details.found || !details.name) {
			return json({ message: 'TV show not found' }, { status: 404 });
		}

		return json({
			id: String(details.tmdbId),
			tmdbId: details.tmdbId,
			title: details.name,
			overview: details.overview ?? null,
			posterPath: details.posterPath ?? null,
			backdropPath: details.backdropPath ?? null,
			releaseDate: details.firstAirDate ?? null,
			rating: details.rating ?? null,
			durationMinutes: details.episodeRuntime ?? null,
			genres: details.genres,
			cast: details.cast,
			trailerUrl: details.trailerUrl ?? null,
			imdbId: details.imdbId ?? null,
			seasonCount: details.seasonCount ?? null,
			episodeCount: details.episodeCount ?? null,
			productionCompanies: details.productionCompanies,
			originCountry: details.originCountry,
			seasons: details.seasons,
			is4K: false,
			isHD: true,
			media_type: 'tv'
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
