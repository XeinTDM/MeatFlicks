import { env } from '$lib/config/env';
import { buildCacheKey, withCache } from '$lib/server/cache';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import { ApiError } from '$lib/server/utils';
import { ofetch } from 'ofetch';
import { TmdbConfigSchema } from './tmdb.schemas';
import type { TmdbConfiguration, TmdbTvEpisode, TmdbTvSeason } from './tmdb.types';
import { TMDB_BASE_URL } from './tmdb.constants';

const CONFIG_TTL = 86400;

export const api = ofetch.create({
	baseURL: TMDB_BASE_URL,
	params: {
		api_key: env.TMDB_API_KEY
	},
	retry: 3,
	retryDelay: 1000,
	onResponseError({ request, response }) {
		if (response.status !== 404) {
			console.error('[ofetch] Response Error:', {
				url: request.toString(),
				status: response.status,
				statusText: response.statusText,
				body: response._data
			});
		}

		throw new ApiError(
			`TMDB responded with status ${response.status}: ${
				response._data?.status_message || response.statusText
			}`,
			response.status
		);
	}
});

let runtimeConfig: TmdbConfiguration['images'] | null = null;

export async function fetchTmdbConfig(): Promise<TmdbConfiguration['images']> {
	const cacheKey = buildCacheKey('tmdb', 'config');

	return withCache(
		cacheKey,
		CONFIG_TTL,
		async () => {
			const rawData = await tmdbRateLimiter.schedule('tmdb-config', () => api('/configuration'));
			const data = TmdbConfigSchema.parse(rawData);
			runtimeConfig = data.images;
			return data.images;
		},
		{ swrSeconds: CONFIG_TTL / 2 }
	);
}

if (typeof process !== 'undefined') {
	fetchTmdbConfig().catch(() => {
		/* ignore */
	});
}

export const buildImageUrl = (segment: string | null | undefined, size: string): string | null => {
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

export function mapTmdbEpisode(e: any): TmdbTvEpisode {
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

export function mapTmdbSeason(data: any): TmdbTvSeason {
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
