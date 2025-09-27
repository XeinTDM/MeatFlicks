import type { StreamingProvider, StreamingSource } from '../types';

function buildVidsrcSource(context: Parameters<StreamingProvider['fetchSource']>[0]): StreamingSource {
  const params = new URLSearchParams({
    tmdb: context.tmdbId.toString()
  });

  if (context.mediaType === 'tv') {
    if (context.season) params.set('season', context.season.toString());
    if (context.episode) params.set('episode', context.episode.toString());
  }

  const streamUrl = `https://vidsrc.me/embed/${context.mediaType}?${params.toString()}`;

  return {
    providerId: 'vidsrc',
    streamUrl,
    reliabilityScore: 0.6,
    notes: 'Public embed endpoint, quality varies by title.'
  };
}

export const vidsrcProvider: StreamingProvider = {
  id: 'vidsrc',
  label: 'VidSrc',
  priority: 20,
  supportedMedia: ['movie', 'tv'],
  async fetchSource(context) {
    if (!context.tmdbId) return null;
    return buildVidsrcSource(context);
  }
};