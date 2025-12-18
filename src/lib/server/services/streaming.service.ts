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

const FAILURE_TTL = 30; // 30 seconds for failures

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

	// Default TTL - Short for streaming as sources change
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

		// If no source found, we might want a shorter TTL for the cache
		// However, withCache handles the factory result.
		// For now, we'll just return the full response.
		return response;
	});
}

export function invalidateStreamingCache() {
	// pattern based invalidation not yet in cache.ts
}
