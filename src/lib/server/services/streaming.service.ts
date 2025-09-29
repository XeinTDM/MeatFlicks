import { collectStreamingSources, resolveStreamingSource } from '$lib/streaming';
import type { MediaType } from '$lib/streaming';
import type { ProviderResolution } from '$lib/streaming/provider-registry';
import { createTtlCache } from '$lib/server/cache';

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

const STREAMING_CACHE_TTL_MS = 1000 * 60 * 5;
const STREAMING_CACHE_FAILURE_TTL_MS = 1000 * 30;

const streamingResolutionCache = createTtlCache<string, ResolveStreamingResponse>({
	ttlMs: STREAMING_CACHE_TTL_MS,
	maxEntries: 500
});

const clone = <T>(value: T): T => {
	if (typeof globalThis.structuredClone === 'function') {
		return globalThis.structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value)) as T;
};

const buildCacheKey = (input: ResolveStreamingInput): string => {
	const providerKey = Array.from(new Set(input.preferredProviders ?? []))
		.sort()
		.join(',');

	return [
		input.mediaType,
		input.tmdbId,
		input.imdbId ?? '',
		input.season ?? '',
		input.episode ?? '',
		input.language ?? '',
		providerKey
	]
		.map((segment) => (segment === null || segment === undefined ? '' : String(segment)))
		.join('::');
};

export async function resolveStreaming(
	input: ResolveStreamingInput
): Promise<ResolveStreamingResponse> {
	if (!input.tmdbId || Number.isNaN(Number(input.tmdbId))) {
		throw new Error('A valid TMDB id is required to resolve streaming sources.');
	}

	const cacheKey = buildCacheKey(input);
	const cached = streamingResolutionCache.get(cacheKey);
	if (cached) {
		return clone(cached);
	}

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

	const hasSuccessfulResolution = Boolean(response.source);
	const ttlOverride = hasSuccessfulResolution ? undefined : STREAMING_CACHE_FAILURE_TTL_MS;
	streamingResolutionCache.set(
		cacheKey,
		response,
		ttlOverride ? { ttlMs: ttlOverride } : undefined
	);

	return clone(response);
}

export function invalidateStreamingCache() {
	streamingResolutionCache.clear();
}
