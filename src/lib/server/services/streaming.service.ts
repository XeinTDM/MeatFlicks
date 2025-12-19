import { collectStreamingSources, resolveStreamingSource } from '$lib/streaming';
import type { MediaType } from '$lib/streaming';
import type { ProviderResolution } from '$lib/streaming/provider-registry';
import { withCache, buildCacheKey, CACHE_TTL_SHORT_SECONDS } from '$lib/server/cache';
import { clone } from '$lib/server/utils';

export interface ResolveStreamingInput {
	mediaType: MediaType;
	tmdbId: number;
	imdbId?: string;
	season?: number;
	episode?: number;
	language?: string;
	preferredProviders?: string[];
}

export interface ResolveStreamingResponse {
	source: Awaited<ReturnType<typeof resolveStreamingSource>>;
	resolutions: ProviderResolution[];
}

const FAILURE_TTL = 30;

export async function resolveStreaming(
	input: ResolveStreamingInput
): Promise<ResolveStreamingResponse> {
	if (!input.tmdbId || Number.isNaN(Number(input.tmdbId))) {
		throw new Error('A valid TMDB id is required to resolve streaming sources.');
	}

	const providerKey = Array.from(new Set(input.preferredProviders ?? []))
		.sort()
		.join(',');

	const cacheKey = buildCacheKey(
		'streaming',
		input.mediaType,
		input.tmdbId,
		input.imdbId,
		input.season,
		input.episode,
		input.language,
		providerKey
	);

	return withCache(cacheKey, CACHE_TTL_SHORT_SECONDS, async () => {
		const context = {
			mediaType: input.mediaType,
			tmdbId: input.tmdbId,
			imdbId: input.imdbId,
			season: input.season,
			episode: input.episode,
			language: input.language
		} as const;

		const resolutions = await collectStreamingSources(context, input.preferredProviders ?? []);
		const source = resolutions.find((resolution) => resolution.success)?.source ?? null;

		const response: ResolveStreamingResponse = {
			source,
			resolutions
		};

		return response;
	});
}

/**
 * Invalidate streaming caches matching a pattern
 * @param pattern - Pattern to match (e.g., 'streaming:movie:*', 'streaming:tv:123:*')
 * @returns Number of cache entries invalidated
 */
export async function invalidateStreamingCache(pattern?: string): Promise<number> {
	const { invalidateCachePattern, invalidateCachePrefix } = await import('$lib/server/cache');
	
	if (pattern) {
		return invalidateCachePattern(pattern);
	}
	
	// Default: invalidate all streaming caches
	return invalidateCachePrefix('streaming:');
}

/**
 * Invalidate cache for a specific streaming source
 * @param tmdbId - TMDB ID to invalidate
 * @param mediaType - Media type ('movie' or 'tv')
 * @param season - Optional season number
 * @param episode - Optional episode number
 * @returns Number of cache entries invalidated
 */
export async function invalidateStreamingSource(
	tmdbId: number,
	mediaType: 'movie' | 'tv',
	season?: number,
	episode?: number
): Promise<number> {
	const { invalidateStreamingSource: invalidateSource } = await import('$lib/server/cache');
	return invalidateSource(tmdbId, mediaType, season, episode);
}
