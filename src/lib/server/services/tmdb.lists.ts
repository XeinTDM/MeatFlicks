import { buildCacheKey, withCache } from '$lib/server/cache';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import { toNumber } from '$lib/server/utils';
import { api } from './tmdb.client';
import { LIST_TTL, TMDB_PAGE_SIZE } from './tmdb.constants';

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
