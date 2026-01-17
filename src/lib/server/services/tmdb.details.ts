import { env } from '$lib/config/env';
import { buildCacheKey, setCachedValue, withCache } from '$lib/server/cache';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import type { LibraryMovie } from '$lib/types/library';
import { ApiError } from '$lib/server/utils';
import {
	TmdbMovieSchema,
	TmdbTvSchema,
	TmdbTvSeasonSchema,
	TmdbRecommendationResponseSchema
} from './tmdb.schemas';
import { DETAILS_TTL, LIST_TTL } from './tmdb.constants';
import { api, buildImageUrl, mapTmdbSeason } from './tmdb.client';
import type {
	TmdbMovieDetails,
	TmdbMovieExtras,
	TmdbTvDetails,
	TmdbTvSeason
} from './tmdb.types';

export interface FetchTvDetailsOptions {
	appendSeasons?: number[];
}

export async function fetchTmdbTvDetails(
	tmdbId: number,
	options: FetchTvDetailsOptions = {}
): Promise<TmdbTvDetails> {
	const { appendSeasons = [] } = options;
	const cacheKey = buildCacheKey(
		'tmdb',
		'tv',
		tmdbId,
		appendSeasons.length > 0 ? `with-s${appendSeasons.join('-')}` : ''
	);

	return withCache(
		cacheKey,
		DETAILS_TTL,
		async () => {
			try {
				const appendStr = [
					'credits',
					'videos',
					'images',
					'external_ids',
					...appendSeasons.map((n) => `season/${n}`)
				].join(',');

				const rawData = (await tmdbRateLimiter.schedule('tmdb-tv-details', () =>
					api(`/tv/${tmdbId}`, {
						query: { append_to_response: appendStr }
					})
				)) as any;

				const data = TmdbTvSchema.parse(rawData);

				const trailer = data.videos?.results.find(
					(v) =>
						v.site.toLowerCase() === 'youtube' &&
						(v.type.toLowerCase() === 'trailer' || v.type.toLowerCase() === 'teaser')
				);

				const logo =
					data.images?.logos?.find((l) => l.iso_639_1 === 'en') || data.images?.logos?.[0];

				const seasons = (data.seasons || [])
					.filter((s) => s.season_number > 0)
					.map((s) => {
						const seasonKey = `season/${s.season_number}`;
						const detailedSeason = rawData[seasonKey];

						if (detailedSeason) {
							try {
								const parsed = TmdbTvSeasonSchema.parse(detailedSeason);
								const mapped = mapTmdbSeason(parsed);

								const seasonCacheKey = buildCacheKey(
									'tmdb',
									'tv',
									tmdbId,
									'season',
									s.season_number
								);
								setImmediate(() => {
									setCachedValue(seasonCacheKey, mapped, DETAILS_TTL).catch(() => {});
								});

								return mapped;
							} catch (e) {
								console.warn(
									`[fetchTmdbTvDetails] Failed to parse appended season ${s.season_number}:`,
									e
								);
							}
						}

						return {
							id: s.id,
							name: s.name,
							overview: s.overview || null,
							posterPath: buildImageUrl(s.poster_path, env.TMDB_POSTER_SIZE),
							seasonNumber: s.season_number,
							episodeCount: s.episode_count || 0,
							airDate: s.air_date || null
						};
					});

				return {
					found: true,
					tmdbId: data.id,
					imdbId: data.external_ids?.imdb_id || null,
					name: data.name || data.original_name || null,
					overview: data.overview || null,
					posterPath: buildImageUrl(data.poster_path, env.TMDB_POSTER_SIZE),
					backdropPath: buildImageUrl(data.backdrop_path, env.TMDB_BACKDROP_SIZE),
					rating: data.vote_average || null,
					genres: data.genres || [],
					cast: (data.credits?.cast || []).slice(0, 10).map((c) => ({
						id: c.id,
						name: c.name,
						character: c.character || null,
						profilePath: buildImageUrl(c.profile_path, env.TMDB_POSTER_SIZE)
					})),
					trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
					episodeRuntimes: data.episode_run_time || [],
					firstAirDate: data.first_air_date || null,
					seasonCount: data.number_of_seasons || null,
					episodeCount: data.number_of_episodes || null,
					status: data.status || null,
					seasons,
					productionCompanies: (data.production_companies || []).map((c) => ({
						id: c.id,
						name: c.name,
						logoPath: buildImageUrl(c.logo_path, env.TMDB_POSTER_SIZE)
					})),
					productionCountries: (data.production_countries || []).map((c) => ({
						iso: c.iso_3166_1,
						name: c.name
					})),
					voteCount: data.vote_count || null,
					logoPath: logo ? buildImageUrl(logo.file_path, env.TMDB_POSTER_SIZE) : null
				};
			} catch (error) {
				console.error(`[fetchTmdbTvDetails] Error for tmdbId ${tmdbId}:`, error);
				if (error instanceof ApiError && error.statusCode === 404) {
					return { found: false, tmdbId } as TmdbTvDetails;
				}
				throw error;
			}
		},
		{ swrSeconds: DETAILS_TTL / 2 }
	);
}

export async function fetchTmdbTvSeason(
	tmdbId: number,
	seasonNumber: number
): Promise<TmdbTvSeason | null> {
	const cacheKey = buildCacheKey('tmdb', 'tv', tmdbId, 'season', seasonNumber);

	return withCache(cacheKey, DETAILS_TTL, async () => {
		try {
			const rawData = await tmdbRateLimiter.schedule('tmdb-tv-season', () =>
				api(`/tv/${tmdbId}/season/${seasonNumber}`)
			);
			const data = TmdbTvSeasonSchema.parse(rawData);
			return mapTmdbSeason(data);
		} catch (error) {
			if (error instanceof ApiError && error.statusCode === 404) {
				return null;
			}
			throw error;
		}
	});
}

export async function fetchTmdbTvSeasonsBatch(
	tmdbId: number,
	seasonNumbers: number[]
): Promise<Map<number, TmdbTvSeason>> {
	const result = new Map<number, TmdbTvSeason>();
	if (seasonNumbers.length === 0) return result;

	const BATCH_SIZE = 20;
	const batches: number[][] = [];
	for (let i = 0; i < seasonNumbers.length; i += BATCH_SIZE) {
		batches.push(seasonNumbers.slice(i, i + BATCH_SIZE));
	}

	await Promise.all(
		batches.map(async (batch) => {
			const appendStr = batch.map((n) => `season/${n}`).join(',');

			try {
				const rawData = (await tmdbRateLimiter.schedule('tmdb-tv-batch-seasons', () =>
					api(`/tv/${tmdbId}`, {
						query: { append_to_response: appendStr }
					})
				)) as any;

				for (const n of batch) {
					const seasonKey = `season/${n}`;
					const seasonData = rawData[seasonKey];
					if (seasonData) {
						const parsed = TmdbTvSeasonSchema.parse(seasonData);
						const mapped = mapTmdbSeason(parsed);
						result.set(n, mapped);

						const seasonCacheKey = buildCacheKey('tmdb', 'tv', tmdbId, 'season', n);
						await setCachedValue(seasonCacheKey, mapped, DETAILS_TTL).catch(() => {});
					}
				}
			} catch (error) {
				console.error(
					`[fetchTmdbTvSeasonsBatch] Failed for batch ${batch} on show ${tmdbId}:`,
					error
				);
			}
		})
	);

	return result;
}

export async function fetchTmdbMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
	const cacheKey = buildCacheKey('tmdb', 'movie', tmdbId);

	return withCache(
		cacheKey,
		DETAILS_TTL,
		async () => {
			try {
				const rawData = await tmdbRateLimiter.schedule('tmdb-movie-details', () =>
					api(`/movie/${tmdbId}`, {
						query: { append_to_response: 'credits,videos,images' }
					})
				);

				const data = TmdbMovieSchema.parse(rawData);

				const trailer = data.videos?.results.find(
					(v) =>
						v.site.toLowerCase() === 'youtube' &&
						(v.type.toLowerCase() === 'trailer' || v.type.toLowerCase() === 'teaser')
				);

				const logo =
					data.images?.logos?.find((l) => l.iso_639_1 === 'en') || data.images?.logos?.[0];

				return {
					found: true,
					tmdbId: data.id,
					imdbId: data.imdb_id || null,
					cast: (data.credits?.cast || []).slice(0, 10).map((c) => ({
						id: c.id,
						name: c.name,
						character: c.character || null,
						profilePath: buildImageUrl(c.profile_path, env.TMDB_POSTER_SIZE)
					})),
					trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
					runtime: data.runtime || null,
					releaseDate: data.release_date || null,
					title: data.title || data.original_title || null,
					overview: data.overview || null,
					posterPath: buildImageUrl(data.poster_path, env.TMDB_POSTER_SIZE),
					backdropPath: buildImageUrl(data.backdrop_path, env.TMDB_BACKDROP_SIZE),
					rating: data.vote_average || null,
					voteCount: data.vote_count || null,
					genres: data.genres || [],
					productionCompanies: (data.production_companies || []).map((c) => ({
						id: c.id,
						name: c.name,
						logoPath: buildImageUrl(c.logo_path, env.TMDB_POSTER_SIZE)
					})),
					productionCountries: (data.production_countries || []).map((c) => ({
						iso: c.iso_3166_1,
						name: c.name
					})),
					logoPath: logo ? buildImageUrl(logo.file_path, env.TMDB_POSTER_SIZE) : null
				};
			} catch (error) {
				console.error(`[fetchTmdbMovieDetails] Error for tmdbId ${tmdbId}:`, error);
				if (error instanceof ApiError && error.statusCode === 404) {
					return { found: false, tmdbId } as TmdbMovieDetails;
				}
				throw error;
			}
		},
		{ swrSeconds: DETAILS_TTL / 2 }
	);
}

export async function fetchTmdbMovieExtras(tmdbId: number): Promise<TmdbMovieExtras> {
	const details = await fetchTmdbMovieDetails(tmdbId);

	return {
		tmdbId: details.tmdbId,
		imdbId: details.imdbId,
		cast: details.cast,
		trailerUrl: details.trailerUrl,
		runtime: details.runtime,
		releaseDate: details.releaseDate,
		productionCompanies: details.productionCompanies,
		productionCountries: details.productionCountries,
		voteCount: details.voteCount,
		logoPath: details.logoPath
	};
}

export async function fetchTmdbRecommendations(
	tmdbId: number,
	mediaType: 'movie' | 'tv',
	limit = 12
): Promise<LibraryMovie[]> {
	const cacheKey = buildCacheKey('tmdb', mediaType, tmdbId, 'recommendations', limit);

	return withCache(cacheKey, LIST_TTL, async () => {
		const [similarRes, recommendRes] = await Promise.all([
			tmdbRateLimiter.schedule(`tmdb-${mediaType}-similar`, () =>
				api(`/${mediaType}/${tmdbId}/similar`, { query: { language: 'en-US', page: 1 } })
			),
			tmdbRateLimiter.schedule(`tmdb-${mediaType}-recommendations`, () =>
				api(`/${mediaType}/${tmdbId}/recommendations`, { query: { language: 'en-US', page: 1 } })
			)
		]);

		const similar = TmdbRecommendationResponseSchema.parse(similarRes).results;
		const recommended = TmdbRecommendationResponseSchema.parse(recommendRes).results;

		const combined = [...recommended, ...similar];
		const unique = new Map<number, (typeof combined)[0]>();
		for (const item of combined) {
			if (!unique.has(item.id)) {
				unique.set(item.id, item);
			}
		}

		return Array.from(unique.values())
			.slice(0, limit)
			.map((item) => {
				const title = item.title || item.name || 'Untitled';
				const releaseDate = item.release_date || item.first_air_date || null;
				const isTv = mediaType === 'tv' || item.media_type === 'tv' || Boolean(item.name);

				return {
					id: String(item.id),
					tmdbId: item.id,
					title,
					overview: null,
					posterPath: buildImageUrl(item.poster_path, env.TMDB_POSTER_SIZE),
					backdropPath: buildImageUrl(item.backdrop_path, env.TMDB_BACKDROP_SIZE),
					releaseDate,
					rating: item.vote_average || 0,
					genres: [],
					media_type: isTv ? 'tv' : 'movie',
					is4K: false,
					isHD: true,
					trailerUrl: null,
					imdbId: null,
					canonicalPath: null,
					addedAt: null,
					mediaType: isTv ? 'tv' : 'movie'
				} as LibraryMovie;
			});
	});
}
