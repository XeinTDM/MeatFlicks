import { env } from '$lib/config/env';
import { withCache, buildCacheKey, CACHE_TTL_MEDIUM_SECONDS, CACHE_TTL_LONG_SECONDS } from '$lib/server/cache';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import { ApiError, RateLimitError, toNumber } from '$lib/server/utils';
import { ofetch } from 'ofetch';
import {
	TmdbMovieSchema,
	TmdbTvSchema,
	TmdbTrendingResponseSchema,
	TmdbFindResponseSchema
} from './tmdb.schemas';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Cache TTLs in seconds (using constants from cache.ts where possible)
const DETAILS_TTL = CACHE_TTL_LONG_SECONDS; // 25 mins
const LIST_TTL = CACHE_TTL_MEDIUM_SECONDS; // 15 mins

export interface TmdbMovieExtras {
	tmdbId: number;
	imdbId: string | null;
	cast: { id: number; name: string; character: string }[];
	trailerUrl: string | null;
	runtime: number | null;
	releaseDate: string | null;
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
	cast: { id: number; name: string; character: string }[];
	trailerUrl: string | null;
	episodeRuntime: number | null;
	firstAirDate: string | null;
	seasonCount: number | null;
	episodeCount: number | null;
}

const api = ofetch.create({
	baseURL: TMDB_BASE_URL,
	params: {
		api_key: env.TMDB_API_KEY
	},
	retry: 3,
	retryDelay: 1000,
	onResponseError({ response }) {
		if (response.status === 429) {
			throw new RateLimitError('TMDB API rate limited', undefined);
		}
		throw new ApiError(`TMDB responded with status ${response.status}: ${response._data?.status_message || response.statusText}`, response.status);
	}
});

const buildImageUrl = (segment: string | null | undefined, size: string): string | null => {
	if (!segment || !segment.trim()) {
		return null;
	}

	const trimmed = segment.trim();
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed;
	}

	return `${env.TMDB_IMAGE_BASE_URL}${size}${trimmed}`;
};

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

const fetchMovieListIds = async (
	path: string,
	params: Record<string, any>,
	limit: number,
	rateLimitKey: string
): Promise<number[]> => {
	const ids: number[] = [];
	const totalPages = Math.ceil(limit / TMDB_PAGE_SIZE);

	for (let page = 1; page <= totalPages; page++) {
		const rateLimit = await tmdbRateLimiter.checkLimit(rateLimitKey);
		if (!rateLimit.allowed) {
			throw new RateLimitError('TMDB rate limit exceeded', rateLimit.resetTime);
		}

		const payload = await api(path, {
			query: {
				language: 'en-US',
				include_adult: 'false',
				page,
				...params
			}
		});

		const results = payload.results;
		if (!Array.isArray(results)) break;

		for (const entry of results) {
			const id = toNumber(entry.id);
			if (id) ids.push(id);
			if (ids.length >= limit) break;
		}

		if (results.length < TMDB_PAGE_SIZE || ids.length >= limit) break;
	}

	return ids;
};

export async function fetchTmdbTvDetails(tmdbId: number): Promise<TmdbTvDetails> {
	const cacheKey = buildCacheKey('tmdb', 'tv', tmdbId);

	return withCache(cacheKey, DETAILS_TTL, async () => {
		const rateLimit = await tmdbRateLimiter.checkLimit('tmdb-tv-details');
		if (!rateLimit.allowed) {
			throw new RateLimitError('TMDB rate limit exceeded', rateLimit.resetTime);
		}

		try {
			const rawData = await api(`/tv/${tmdbId}`, {
				query: { append_to_response: 'credits,videos,external_ids' }
			});

			const data = TmdbTvSchema.parse(rawData);

			const trailer = data.videos?.results.find(v =>
				v.site.toLowerCase() === 'youtube' &&
				(v.type.toLowerCase() === 'trailer' || v.type.toLowerCase() === 'teaser')
			);

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
				cast: (data.credits?.cast || []).slice(0, 10),
				trailerUrl: trailer ? `https://www.youtube.com/embed/${trailer.key}` : null,
				episodeRuntime: data.episode_run_time?.[0] || null,
				firstAirDate: data.first_air_date || null,
				seasonCount: data.number_of_seasons || null,
				episodeCount: data.number_of_episodes || null
			};
		} catch (error) {
			if (error instanceof ApiError && error.statusCode === 404) {
				return { found: false, tmdbId } as TmdbTvDetails;
			}
			throw error;
		}
	});
}

export async function fetchTmdbMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
	const cacheKey = buildCacheKey('tmdb', 'movie', tmdbId);

	return withCache(cacheKey, DETAILS_TTL, async () => {
		const rateLimit = await tmdbRateLimiter.checkLimit('tmdb-movie-details');
		if (!rateLimit.allowed) {
			throw new RateLimitError('TMDB rate limit exceeded', rateLimit.resetTime);
		}

		try {
			const rawData = await api(`/movie/${tmdbId}`, {
				query: { append_to_response: 'credits,videos' }
			});

			const data = TmdbMovieSchema.parse(rawData);

			const trailer = data.videos?.results.find(v =>
				v.site.toLowerCase() === 'youtube' &&
				(v.type.toLowerCase() === 'trailer' || v.type.toLowerCase() === 'teaser')
			);

			return {
				found: true,
				tmdbId: data.id,
				imdbId: data.imdb_id || null,
				cast: (data.credits?.cast || []).slice(0, 10),
				trailerUrl: trailer ? `https://www.youtube.com/embed/${trailer.key}` : null,
				runtime: data.runtime || null,
				releaseDate: data.release_date || null,
				title: data.title || data.original_title || null,
				overview: data.overview || null,
				posterPath: buildImageUrl(data.poster_path, env.TMDB_POSTER_SIZE),
				backdropPath: buildImageUrl(data.backdrop_path, env.TMDB_BACKDROP_SIZE),
				rating: data.vote_average || null,
				genres: data.genres || []
			};
		} catch (error) {
			if (error instanceof ApiError && error.statusCode === 404) {
				return { found: false, tmdbId } as TmdbMovieDetails;
			}
			throw error;
		}
	});
}

export async function fetchTrendingMovieIds(limit = 20): Promise<number[]> {
	const cacheKey = buildCacheKey('tmdb', 'trending', limit);

	return withCache(cacheKey, LIST_TTL, async () => {
		const rateLimit = await tmdbRateLimiter.checkLimit('tmdb-trending');
		if (!rateLimit.allowed) {
			throw new RateLimitError('TMDB rate limit exceeded', rateLimit.resetTime);
		}

		const rawData = await api('/trending/movie/week', {
			query: { language: 'en-US' }
		});

		const data = TmdbTrendingResponseSchema.parse(rawData);
		return data.results.slice(0, limit).map(r => r.id);
	});
}

export async function fetchPopularMovieIds(limit = 20): Promise<number[]> {
	const cacheKey = buildCacheKey('tmdb', 'popular', limit);

	return withCache(cacheKey, LIST_TTL, () =>
		fetchMovieListIds('/movie/popular', { region: 'US' }, limit, 'tmdb-popular')
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
		'sort_by': sortBy,
		'vote_average.gte': minVoteAverage,
		'vote_count.gte': minVoteCount,
		language,
		'primary_release_date.gte': releaseDateGte,
		'primary_release_date.lte': releaseDateLte
	};

	const cacheKey = buildCacheKey('tmdb', 'discover', JSON.stringify(params), limit);

	return withCache(cacheKey, LIST_TTL, () =>
		fetchMovieListIds('/discover/movie', params, limit, 'tmdb-discover')
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
		releaseDate: details.releaseDate
	};
}

export async function lookupTmdbIdByImdbId(imdbId: string): Promise<number | null> {
	const normalized = imdbId.trim().toLowerCase();
	if (!/^tt\d+$/.test(normalized)) {
		return null;
	}

	const cacheKey = buildCacheKey('tmdb', 'lookup', normalized);

	return withCache(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
		const rateLimit = await tmdbRateLimiter.checkLimit('tmdb-imdb-lookup');
		if (!rateLimit.allowed) {
			throw new RateLimitError('TMDB rate limit exceeded', rateLimit.resetTime);
		}

		const rawData = await api(`/find/${normalized}`, {
			query: { external_source: 'imdb_id' }
		});

		const data = TmdbFindResponseSchema.parse(rawData);
		return data.movie_results[0]?.id || data.tv_results[0]?.id || null;
	});
}

export function invalidateTmdbCaches() {
	// Note: With persistent cache, we don't have a simple 'clear' for specific patterns yet
	// but we can clear the memory L1 cache if needed.
}
