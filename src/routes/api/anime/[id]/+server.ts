import { json, type RequestHandler } from '@sveltejs/kit';
import { buildCacheKey, CACHE_TTL_LONG_SECONDS, withCache } from '$lib/server/cache';
import {
	fetchTmdbTvDetails,
	fetchTmdbMovieDetails,
	lookupTmdbIdByImdbId,
	fetchMalId
} from '$lib/server/services/tmdb.service';
import type { TmdbTvDetails, TmdbMovieDetails } from '$lib/server/services/tmdb.service';
import { z } from 'zod';
import { validatePathParams, validateQueryParams, queryModeSchema } from '$lib/server/validation';
import { errorHandler } from '$lib/server';

const animeIdentifierSchema = z.object({
	id: z.string().min(1, 'Anime identifier is required')
});

const animeQueryParamsSchema = z.object({
	by: queryModeSchema.optional()
});

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const pathParams = validatePathParams(animeIdentifierSchema, params);
		const queryParams = validateQueryParams(animeQueryParamsSchema, url.searchParams);

		const identifier = pathParams.id;
		const queryMode = queryParams.by ?? (identifier.startsWith('tt') ? 'imdb' : 'tmdb');

		let tmdbId: number | null = null;

		if (queryMode === 'imdb') {
			tmdbId = await lookupTmdbIdByImdbId(identifier);
			if (!tmdbId) {
				return json({ message: 'Anime not found' }, { status: 404 });
			}
		} else {
			const parsed = Number.parseInt(identifier, 10);
			if (!Number.isFinite(parsed) || parsed <= 0) {
				return json({ error: 'A valid TMDB id is required.' }, { status: 400 });
			}
			tmdbId = parsed;
		}

		// Try to get TV details first (most anime are series)
		const tvCacheKey = buildCacheKey('tv', tmdbId);
		let details: any = await withCache<TmdbTvDetails>(tvCacheKey, CACHE_TTL_LONG_SECONDS, () =>
			fetchTmdbTvDetails(tmdbId!)
		);

		let mediaType: 'tv' | 'movie' = 'tv';

		if (!details.found || !details.name) {
			// Try movie if TV not found
			const movieCacheKey = buildCacheKey('movie', tmdbId);
			details = await withCache<TmdbMovieDetails>(movieCacheKey, CACHE_TTL_LONG_SECONDS, () =>
				fetchTmdbMovieDetails(tmdbId!)
			);
			mediaType = 'movie';
		}

		if (!details.found || (!details.name && !details.title)) {
			return json({ message: 'Anime not found' }, { status: 404 });
		}

		const title = details.name || details.title;
		const releaseDate = details.firstAirDate || details.releaseDate;

		// Fetch MAL ID
		const malId = await fetchMalId(title, releaseDate);

		return json({
			id: String(details.tmdbId),
			tmdbId: details.tmdbId,
			title,
			overview: details.overview ?? null,
			posterPath: details.posterPath ?? null,
			backdropPath: details.backdropPath ?? null,
			releaseDate: releaseDate ?? null,
			rating: details.rating ?? null,
			durationMinutes: details.episodeRuntime || details.runtime || null,
			genres: details.genres,
			cast: details.cast,
			trailerUrl: details.trailerUrl ?? null,
			imdbId: details.imdbId ?? null,
			malId,
			seasonCount: details.seasonCount ?? (mediaType === 'movie' ? 1 : null),
			episodeCount: details.episodeCount ?? (mediaType === 'movie' ? 1 : null),
			productionCompanies: details.productionCompanies,
			seasons:
				details.seasons ||
				(mediaType === 'movie'
					? [
							{
								id: details.tmdbId,
								name: 'Movie',
								seasonNumber: 1,
								episodeCount: 1,
								posterPath: details.posterPath
							}
						]
					: []),
			is4K: false,
			isHD: true,
			media_type: 'anime'
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
