import { collectStreamingSources, resolveStreamingSource, listStreamingProviders } from '$lib/streaming';
import type { MediaType } from '$lib/streaming';
import type { ProviderResolution } from '$lib/streaming/provider-registry';
import { withCache, buildCacheKey, CACHE_TTL_SHORT_SECONDS, getCachedValue, setCachedValue } from '$lib/server/cache';
import { logger } from '$lib/server/logger';

export interface ResolveStreamingInput {
	mediaType: MediaType;
	tmdbId: number;
	imdbId?: string;
	malId?: number;
	subOrDub?: 'sub' | 'dub';
	season?: number;
	episode?: number;
	language?: string;
	preferredProviders?: string[];
	startAt?: number;
	sub_file?: string;
	sub_label?: string;
}

export interface ResolveStreamingResponse {
	source: Awaited<ReturnType<typeof resolveStreamingSource>>;
	resolutions: ProviderResolution[];
}

const FAILURE_TTL = 3600; // 1 hour cooldown for broken providers

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
			malId: input.malId,
			subOrDub: input.subOrDub,
			season: input.season,
			episode: input.episode,
			language: input.language,
			startAt: input.startAt,
			sub_file: input.sub_file,
			sub_label: input.sub_label
		} as const;

		// Get all available providers
		const providers = listStreamingProviders();
		
		// Fetch failure counts for each provider
		const providerScores = await Promise.all(
			providers.map(async (p) => {
				const failKey = buildCacheKey('provider-failure', p.id);
				const failCount = (await getCachedValue<number>(failKey)) || 0;
				// Base priority minus failures (each failure is a heavy penalty)
				return { id: p.id, score: (p as any).priority - failCount * 10 };
			})
		);

		// Sort providers by score DESC
		const sortedProviderIds = providerScores
			.sort((a, b) => b.score - a.score)
			.map(p => p.id);

		// If no preferred providers were passed, use our scored order
		const effectivePreferred = input.preferredProviders && input.preferredProviders.length > 0 
			? input.preferredProviders 
			: sortedProviderIds;

		const source = await resolveStreamingSource(context, effectivePreferred);

		const resolutions: ProviderResolution[] = [];
		if (source) {
			const provider = providers.find((p) => p.id === source.providerId);
			resolutions.push({
				providerId: source.providerId,
				label: provider?.label ?? source.providerId,
				success: true,
				source
			});
		}

		return {
			source,
			resolutions
		};
	});
}

/**
 * Reports a provider as broken for a specific media item.
 * Temporarily deprioritizes this provider for all users.
 */
export async function reportBrokenLink(providerId: string) {
	const failKey = buildCacheKey('provider-failure', providerId);
	const currentFails = (await getCachedValue<number>(failKey)) || 0;
	
	logger.warn({ providerId, currentFails }, '[streaming] Provider reported broken, incrementing failure count');
	
	// Increment failure count and cache for 1 hour
	await setCachedValue(failKey, currentFails + 1, FAILURE_TTL);
	
	// Invalidate ALL streaming caches so providers are re-ordered
	await invalidateStreamingCache();
}

/**
 * Invalidate streaming caches matching a pattern
 */
export async function invalidateStreamingCache(pattern?: string): Promise<number> {
	const { invalidateCachePattern, invalidateCachePrefix } = await import('$lib/server/cache');

	if (pattern) {
		return invalidateCachePattern(pattern);
	}

	return invalidateCachePrefix('streaming:');
}

/**
 * Invalidate cache for a specific streaming source
 */
export async function invalidateStreamingSource(
	tmdbId: number,
	mediaType: MediaType,
	season?: number,
	episode?: number
): Promise<number> {
	const { invalidateStreamingSource: invalidateSource } = await import('$lib/server/cache');
	return invalidateSource(tmdbId, mediaType, season, episode);
}