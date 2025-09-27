import { streamingConfig } from '$lib/config/streaming';
import {
  DEFAULT_EMBED_PATHS,
  DEFAULT_STREAM_PATHS,
  ensureAbsoluteUrl,
  extractFirstUrl,
  fetchWithTimeout
} from '../provider-helpers';
import type { StreamingProvider } from '../types';

const { embedSu } = streamingConfig;

function buildQuery(context: Parameters<StreamingProvider['fetchSource']>[0]): URLSearchParams {
  const params = new URLSearchParams({
    tmdb: context.tmdbId.toString()
  });

  if (context.imdbId) {
    params.set('imdb', context.imdbId);
  }

  if (context.mediaType === 'tv') {
    if (context.season) params.set('season', context.season.toString());
    if (context.episode) params.set('episode', context.episode.toString());
  }

  if (context.language) {
    params.set('lang', context.language);
  }

  return params;
}

function fallbackSource(context: Parameters<StreamingProvider['fetchSource']>[0], params: URLSearchParams) {
  const embedUrl = `${embedSu.baseUrl}/embed/${context.mediaType}?${params.toString()}`;

  return {
    providerId: 'embed-su',
    streamUrl: embedUrl,
    embedUrl,
    reliabilityScore: 0.45,
    notes: 'Fallback to embed.su player; consider alternative providers if unavailable.'
  } as const;
}

async function requestEmbedSu(context: Parameters<StreamingProvider['fetchSource']>[0]) {
  const params = buildQuery(context);
  const endpoint = `${embedSu.baseUrl}/api/${context.mediaType}`;

  try {
    const response = await fetchWithTimeout(`${endpoint}?${params.toString()}`, {
      headers: { accept: 'application/json, text/json, */*' },
      timeoutMs: 10000
    });

    if (!response.ok) {
      throw new Error(`Embed.su responded with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      return fallbackSource(context, params);
    }

    const payload = await response.json();
    const streamCandidate = ensureAbsoluteUrl(
      embedSu.baseUrl,
      extractFirstUrl(payload, DEFAULT_STREAM_PATHS)
    );
    const embedCandidate = ensureAbsoluteUrl(
      embedSu.baseUrl,
      extractFirstUrl(payload, DEFAULT_EMBED_PATHS)
    );

    if (!streamCandidate && !embedCandidate) {
      return fallbackSource(context, params);
    }

    return {
      providerId: 'embed-su',
      streamUrl: streamCandidate ?? embedCandidate!,
      embedUrl: embedCandidate ?? undefined,
      reliabilityScore: streamCandidate ? 0.65 : 0.5,
      notes: streamCandidate ? 'Direct stream resolved from embed.su API.' : 'Embed resolved from embed.su API.'
    } as const;
  } catch (error) {
    console.warn('[streaming][embed.su]', error);
    return fallbackSource(context, params);
  }
}

export const embedSuProvider: StreamingProvider = {
  id: 'embed-su',
  label: 'Embed.su',
  priority: 15,
  supportedMedia: ['movie', 'tv'],
  async fetchSource(context) {
    if (!context.tmdbId) return null;
    return requestEmbedSu(context);
  }
};
