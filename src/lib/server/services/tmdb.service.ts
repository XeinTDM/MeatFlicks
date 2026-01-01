import { env } from '$lib/config/env';
import {
	withCache,
	buildCacheKey,
	setCachedValue,
	CACHE_TTL_MEDIUM_SECONDS,
	CACHE_TTL_LONG_SECONDS
} from '$lib/server/cache';
import type { LibraryMovie } from '$lib/types/library';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import { ApiError, toNumber } from '$lib/server/utils';
import { ofetch } from 'ofetch';
import {
	TmdbMovieSchema,
	TmdbTvSchema,
	TmdbTrendingResponseSchema,
	TmdbFindResponseSchema,
	TmdbTvSeasonSchema,
	TmdbRecommendationResponseSchema,
	TmdbPersonSchema,
	TmdbConfigSchema,
	TmdbCreditsSchema,
	TmdbCrewMemberSchema
} from './tmdb.schemas';
import { z } from 'zod';

export type TmdbConfiguration = z.infer<typeof TmdbConfigSchema>;

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const DETAILS_TTL = CACHE_TTL_LONG_SECONDS;
const LIST_TTL = CACHE_TTL_MEDIUM_SECONDS;

export interface TmdbMovieExtras {
	tmdbId: number;
	imdbId: string | null;
	cast: { id: number; name: string; character?: string | null; profilePath?: string | null }[];
	trailerUrl: string | null;
	runtime: number | null;
	releaseDate: string | null;
	productionCompanies: { id: number; name: string; logoPath: string | null }[];
	productionCountries: { iso: string; name: string }[];
	voteCount: number | null;
	logoPath: string | null;
}

export interface TmdbMovieGenre {
	id: number;
	name: string;
}

export interface TmdbMovieDetails extends TmdbMovieExtras {
	found: boolean;
	title: string | null;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	rating: number | null;
	genres: TmdbMovieGenre[];
}

export interface TmdbTvDetails {
	found: boolean;
	tmdbId: number;
	imdbId: string | null;
	name: string | null;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	rating: number | null;
	genres: TmdbMovieGenre[];
	cast: { id: number; name: string; character?: string | null; profilePath?: string | null }[];
	trailerUrl: string | null;
	episodeRuntimes: number[];
	firstAirDate: string | null;
	seasonCount: number | null;
	episodeCount: number | null;

	seasons: TmdbTvSeason[];
	productionCompanies: { id: number; name: string; logoPath: string | null }[];
	logoPath: string | null;
}

export interface TmdbTvSeason {
	id: number;
	name: string;
	overview: string | null;
	posterPath: string | null;
	seasonNumber: number;
	episodeCount: number;
	airDate: string | null;
	episodes?: TmdbTvEpisode[];
}

export interface TmdbTvEpisode {
	id: number;
	name: string;
	overview: string | null;
	episodeNumber: number;
	seasonNumber: number;
	airDate: string | null;
	stillPath: string | null;
	voteAverage: number | null;
	runtime: number | null;
}

export interface TmdbPersonCredit {
	id: number;
	title: string;
	character?: string;
	job?: string;
	department?: string;
	posterPath: string | null;
	mediaType: 'movie' | 'tv';
	year: string;
}

export interface TmdbPersonDetails {
	id: number;
	name: string;
	biography: string;
	birthday: string | null;
	deathday: string | null;
	placeOfBirth: string | null;
	profilePath: string | null;
	knownFor: TmdbPersonCredit[];
	images: string[];
}

export interface TmdbMediaCredits {
	cast: { id: number; name: string; character: string }[];
	crew: { id: number; name: string; department: string; job: string }[];
}

const api = ofetch.create({
	baseURL: TMDB_BASE_URL,
	params: {
		api_key: env.TMDB_API_KEY
	},
	retry: 3,
	retryDelay: 1000,
	onResponseError({ request, response, options }) {
		console.error('[ofetch] Response Error:', {
			url: request.toString(),
			status: response.status,
			statusText: response.statusText,
			body: response._data
		});
		throw new ApiError(
			`TMDB responded with status ${response.status}: ${response._data?.status_message || response.statusText}`,
			response.status
		);
	}
});

let runtimeConfig: TmdbConfiguration['images'] | null = null;

export async function fetchTmdbConfig(): Promise<TmdbConfiguration['images']> {
	const cacheKey = buildCacheKey('tmdb', 'config');

	return withCache(
		cacheKey,
		86400,
		async () => {
			const rawData = await tmdbRateLimiter.schedule('tmdb-config', () => api('/configuration'));
			const data = TmdbConfigSchema.parse(rawData);
			runtimeConfig = data.images;
			return data.images;
		},
		{ swrSeconds: 43200 }
	);
}

if (typeof process !== 'undefined') {
	fetchTmdbConfig().catch(() => {
		/* ignore */
	});
}

const buildImageUrl = (segment: string | null | undefined, size: string): string | null => {
	if (!segment || !segment.trim()) {
		return null;
	}

	const trimmed = segment.trim();
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed;
	}

	const baseUrl = runtimeConfig?.secure_base_url || env.TMDB_IMAGE_BASE_URL;
	return `${baseUrl}${size}${trimmed}`;
};

function mapTmdbEpisode(e: any): TmdbTvEpisode {
	return {
		id: e.id,
		name: e.name,
		overview: e.overview || null,
		episodeNumber: e.episode_number,
		seasonNumber: e.season_number,
		airDate: e.air_date || null,
		stillPath: buildImageUrl(e.still_path, env.TMDB_STILL_SIZE || 'original'),
		voteAverage: e.vote_average || null,
		runtime: e.runtime || null
	};
}

function mapTmdbSeason(data: any): TmdbTvSeason {
	return {
		id: data.id,
		name: data.name,
		overview: data.overview || null,
		posterPath: buildImageUrl(data.poster_path, env.TMDB_POSTER_SIZE),
		seasonNumber: data.season_number,
		episodeCount: data.episode_count || 0,
		airDate: data.air_date || null,
		episodes: (data.episodes || []).map(mapTmdbEpisode)
	};
}

export interface DiscoverMovieOptions {
	genreId?: number;
	limit?: number;
	minVoteAverage?: number;
	minVoteCount?: number;
	sortBy?: string;
	language?: string;
	releaseDateGte?: string;
	releaseDateLte?: string;
}

const TMDB_PAGE_SIZE = 20;

const fetchTmdbListIds = async (
	path: string,
	params: Record<string, any>,
	limit: number,
	rateLimitKey: string
): Promise<number[]> => {
	const totalPages = Math.ceil(limit / TMDB_PAGE_SIZE);
	const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

	const responses = await Promise.all(
		pages.map((page) =>
			tmdbRateLimiter.schedule(rateLimitKey, () =>
				api(path, {
					query: {
						language: 'en-US',
						include_adult: 'false',
						page,
						...params
					}
				})
			)
		)
	);

	const ids: number[] = [];
	for (const payload of responses) {
		const results = (payload as any).results;
		if (!Array.isArray(results)) continue;

		for (const entry of results) {
			const id = toNumber(entry.id);
			if (id) ids.push(id);
			if (ids.length >= limit) break;
		}

		if (ids.length >= limit) break;
	}

	return ids;
};

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
					seasons,
					productionCompanies: (data.production_companies || []).map((c) => ({
						id: c.id,
						name: c.name,
						logoPath: buildImageUrl(c.logo_path, env.TMDB_POSTER_SIZE)
					})),
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

/**
 * Fetches multiple seasons in batches using append_to_response to minimize HTTP requests.
 */
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

export async function fetchTrendingMovieIds(limit = 20): Promise<number[]> {
	const cacheKey = buildCacheKey('tmdb', 'trending', 'movie', limit);

	return withCache(
		cacheKey,
		LIST_TTL,
		() => fetchTmdbListIds('/trending/movie/week', {}, limit, 'tmdb-trending-movie'),
		{ swrSeconds: LIST_TTL / 2 }
	);
}

export async function fetchTrendingTvIds(limit = 20): Promise<number[]> {
	const cacheKey = buildCacheKey('tmdb', 'trending', 'tv', limit);

	return withCache(
		cacheKey,
		LIST_TTL,
		() => fetchTmdbListIds('/trending/tv/week', {}, limit, 'tmdb-trending-tv'),
		{ swrSeconds: LIST_TTL / 2 }
	);
}

export async function fetchPopularMovieIds(limit = 20): Promise<number[]> {
	const cacheKey = buildCacheKey('tmdb', 'popular', 'movie', limit);

	return withCache(
		cacheKey,
		LIST_TTL,
		() => fetchTmdbListIds('/movie/popular', { region: 'US' }, limit, 'tmdb-popular-movie'),
		{ swrSeconds: LIST_TTL / 2 }
	);
}

export async function fetchPopularTvIds(limit = 20): Promise<number[]> {
	const cacheKey = buildCacheKey('tmdb', 'popular', 'tv', limit);

	return withCache(
		cacheKey,
		LIST_TTL,
		() => fetchTmdbListIds('/tv/popular', {}, limit, 'tmdb-popular-tv'),
		{ swrSeconds: LIST_TTL / 2 }
	);
}

export async function discoverMovieIds(options: DiscoverMovieOptions = {}): Promise<number[]> {
	const {
		genreId,
		limit = 40,
		minVoteAverage = 7,
		minVoteCount = 250,
		sortBy = 'popularity.desc',
		language = 'en-US',
		releaseDateGte,
		releaseDateLte
	} = options;

	const params = {
		with_genres: genreId,
		sort_by: sortBy,
		'vote_average.gte': minVoteAverage,
		'vote_count.gte': minVoteCount,
		language,
		'primary_release_date.gte': releaseDateGte,
		'primary_release_date.lte': releaseDateLte
	};

	const cacheKey = buildCacheKey('tmdb', 'discover', 'movie', JSON.stringify(params), limit);

	return withCache(
		cacheKey,
		LIST_TTL,
		() => fetchTmdbListIds('/discover/movie', params, limit, 'tmdb-discover-movie'),
		{ swrSeconds: LIST_TTL / 2 }
	);
}

export async function discoverTvIds(options: DiscoverMovieOptions = {}): Promise<number[]> {
	const {
		genreId,
		limit = 40,
		minVoteAverage = 7,
		minVoteCount = 250,
		sortBy = 'popularity.desc',
		language = 'en-US',
		releaseDateGte,
		releaseDateLte
	} = options;

	const params = {
		with_genres: genreId,
		sort_by: sortBy,
		'vote_average.gte': minVoteAverage,
		'vote_count.gte': minVoteCount,
		language,
		'first_air_date.gte': releaseDateGte,
		'first_air_date.lte': releaseDateLte
	};

	const cacheKey = buildCacheKey('tmdb', 'discover', 'tv', JSON.stringify(params), limit);

	return withCache(
		cacheKey,
		LIST_TTL,
		() => fetchTmdbListIds('/discover/tv', params, limit, 'tmdb-discover-tv'),
		{ swrSeconds: LIST_TTL / 2 }
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

export async function lookupTmdbIdByImdbId(imdbId: string): Promise<number | null> {
	const normalized = imdbId.trim().toLowerCase();
	if (!/^tt\d+$/.test(normalized)) {
		return null;
	}

	const cacheKey = buildCacheKey('tmdb', 'lookup', normalized);

	return withCache(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
		const rawData = await tmdbRateLimiter.schedule('tmdb-imdb-lookup', () =>
			api(`/find/${normalized}`, {
				query: { external_source: 'imdb_id' }
			})
		);

		const data = TmdbFindResponseSchema.parse(rawData);
		return data.movie_results[0]?.id || data.tv_results[0]?.id || null;
	});
}

/**
 * Invalidate TMDB caches matching a pattern
 * @param pattern - Pattern to match (e.g., 'tmdb:movie:*', 'tmdb:tv:123:*', 'tmdb:person:*')
 * @returns Number of cache entries invalidated
 */
export async function invalidateTmdbCaches(pattern?: string): Promise<number> {
	const { invalidateCachePattern, invalidateCachePrefix } = await import('$lib/server/cache');

	if (pattern) {
		return invalidateCachePattern(pattern);
	}

	return invalidateCachePrefix('tmdb:');
}

/**
 * Invalidate caches for a specific TMDB ID
 * @param tmdbId - TMDB ID to invalidate
 * @param mediaType - Optional media type filter
 * @returns Number of cache entries invalidated
 */
export async function invalidateTmdbId(
	tmdbId: number,
	mediaType?: 'movie' | 'tv'
): Promise<number> {
	const { invalidateTmdbId: invalidateById } = await import('$lib/server/cache');
	return invalidateById(tmdbId, mediaType);
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

export async function fetchTmdbPersonDetails(personId: number): Promise<TmdbPersonDetails> {
	const cacheKey = buildCacheKey('tmdb', 'person', personId);

	return withCache(cacheKey, DETAILS_TTL, async () => {
		try {
			const rawData = await tmdbRateLimiter.schedule('tmdb-person-details', () =>
				api(`/person/${personId}`, {
					query: { append_to_response: 'combined_credits,images' }
				})
			);

			const data = TmdbPersonSchema.parse(rawData);

			const credits = [
				...(data.combined_credits?.cast || []).map((c) => ({ ...c, job: 'Actor' })),
				...(data.combined_credits?.crew || [])
			]
				.filter((c) => ('vote_average' in c ? c.vote_average && c.vote_average > 0 : true))
				.sort((a, b) => {
					const dateA =
						('release_date' in a ? a.release_date : '') ||
						('first_air_date' in a ? a.first_air_date : '') ||
						'';
					const dateB =
						('release_date' in b ? b.release_date : '') ||
						('first_air_date' in b ? b.first_air_date : '') ||
						'';
					return dateB.localeCompare(dateA);
				})
				.map((c) => ({
					id: c.id,
					title: c.title || c.name || 'Untitled',
					character: 'character' in c ? c.character : undefined,
					job: 'job' in c ? c.job : undefined,
					department: 'department' in c ? c.department : undefined,
					posterPath: buildImageUrl(c.poster_path, env.TMDB_POSTER_SIZE),
					mediaType: (c.media_type as 'movie' | 'tv') || 'movie',
					year: (
						('release_date' in c ? c.release_date : '') ||
						('first_air_date' in c ? c.first_air_date : '') ||
						''
					).substring(0, 4)
				}));

			return {
				id: data.id,
				name: data.name,
				biography: data.biography || '',
				birthday: data.birthday || null,
				deathday: data.deathday || null,
				placeOfBirth: data.place_of_birth || null,
				profilePath: buildImageUrl(data.profile_path, env.TMDB_POSTER_SIZE),
				knownFor: credits,
				images: (data.images?.profiles || [])
					.map((i) => buildImageUrl(i.file_path, env.TMDB_POSTER_SIZE))
					.filter((s): s is string => s !== null)
			};
		} catch (error) {
			if (error instanceof ApiError && error.statusCode === 404) {
				throw new Error('Person not found');
			}
			throw error;
		}
	});
}

export async function searchTmdbMoviesByPeople(
	personIds: number[],
	roles: string[],
	limit: number
): Promise<LibraryMovie[]> {
	const cacheKey = buildCacheKey(
		'tmdb',
		'movies-by-people',
		personIds.join(','),
		roles.join(','),
		limit
	);

	return withCache(cacheKey, LIST_TTL, async () => {
		const params: Record<string, any> = {
			language: 'en-US',
			include_adult: 'false',
			sort_by: 'popularity.desc'
		};

		if (personIds.length > 0) {
			params.with_cast = personIds.join(',');
		}

		if (roles.length > 0) {
			params.with_crew = personIds.join(',');
		}

		const rawData = await tmdbRateLimiter.schedule('tmdb-movies-by-people', () =>
			api('/discover/movie', {
				query: params
			})
		);

		const data = TmdbTrendingResponseSchema.parse(rawData);
		const movies = data.results.slice(0, limit);
		const libraryMovies: LibraryMovie[] = [];

		for (const movie of movies) {
			const title = movie.title || movie.original_title || 'Untitled';
			const releaseDate = movie.release_date || null;

			libraryMovies.push({
				id: String(movie.id),
				tmdbId: movie.id,
				title,
				overview: movie.overview || null,
				posterPath: buildImageUrl(movie.poster_path, env.TMDB_POSTER_SIZE),
				backdropPath: buildImageUrl(movie.backdrop_path, env.TMDB_BACKDROP_SIZE),
				releaseDate,
				rating: movie.vote_average || 0,
				genres: [],
				media_type: 'movie',
				is4K: false,
				isHD: true,
				trailerUrl: null,
				imdbId: null,
				canonicalPath: `/movie/${movie.id}`,
				addedAt: null,
				mediaType: 'movie'
			});
		}

		return libraryMovies;
	});
}

export async function fetchTmdbMediaCredits(
	tmdbId: number,
	mediaType: 'movie' | 'tv' | 'anime'
): Promise<TmdbMediaCredits | null> {
	const tmdbType = mediaType === 'tv' ? 'tv' : 'movie';
	const cacheKey = buildCacheKey('tmdb', tmdbType, tmdbId, 'credits');

	return withCache(cacheKey, DETAILS_TTL, async () => {
		try {
			const rawData = await tmdbRateLimiter.schedule(`tmdb-${tmdbType}-credits`, () =>
				api(`/${tmdbType}/${tmdbId}/credits`)
			);
			const data = TmdbCreditsSchema.parse(rawData);

			return {
				cast: (data.cast || []).map((c) => ({
					id: c.id,
					name: c.name,
					character: c.character || ''
				})),
				crew: (data.crew || []).map((c) => ({
					id: c.id,
					name: c.name,
					department: c.department || '',
					job: c.job || ''
				}))
			};
		} catch (error) {
			if (error instanceof ApiError && error.statusCode === 404) {
				return null;
			}
			throw error;
		}
	});
}

export async function fetchMalId(title: string, year?: string): Promise<number | null> {
	const cacheKey = buildCacheKey('mal', 'search', title, year || 'any');

	return withCache(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
		try {
			const query: Record<string, string> = { q: title, limit: '1' };
			if (year) {
				const releaseYear = year.split('-')[0];
				if (releaseYear) {
					query.start_date = `${releaseYear}`;
				}
			}

			const response = await fetch(`https://api.jikan.moe/v4/anime?${new URLSearchParams(query)}`);
			if (!response.ok) {
				if (response.status === 429) {
					console.warn('[MAL] Rate limited by Jikan');
				}
				return null;
			}

			const data = await response.json();
			const result = data.data?.[0];

			if (!result) return null;

			const malTitle = (result.title || '').toLowerCase();
			if (!malTitle.includes(title.toLowerCase()) && !title.toLowerCase().includes(malTitle)) {
				console.warn(`[MAL] Title mismatch: ${title} vs ${result.title}`);
			}

			return result.mal_id || null;
		} catch (error) {
			console.warn('[MAL] Failed to fetch MAL ID', error);
			return null;
		}
	});
}
