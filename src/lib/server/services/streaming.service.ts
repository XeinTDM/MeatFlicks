import { collectStreamingSources, resolveStreamingSource } from '$lib/streaming';
import type { MediaType } from '$lib/streaming';
import type { ProviderResolution } from '$lib/streaming/provider-registry';

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

export async function resolveStreaming(input: ResolveStreamingInput): Promise<ResolveStreamingResponse> {
  if (!input.tmdbId || Number.isNaN(Number(input.tmdbId))) {
    throw new Error('A valid TMDB id is required to resolve streaming sources.');
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

  return {
    source,
    resolutions
  };
}
