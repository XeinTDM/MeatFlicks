import type { StreamingProvider, StreamingSource } from '../types';

function buildTwoEmbedSource(context: Parameters<StreamingProvider['fetchSource']>[0]): StreamingSource {
  const params = new URLSearchParams({
    tmdb: context.tmdbId.toString()
  });

  if (context.mediaType === 'tv') {
    if (context.season) params.set('season', context.season.toString());
    if (context.episode) params.set('episode', context.episode.toString());
  }

  const streamUrl = `https://www.2embed.to/embed/${context.mediaType}?${params.toString()}`;

  return {
    providerId: '2embed',
    streamUrl,
    reliabilityScore: 0.55,
    notes: 'Supports multiple mirrors, but may require scraping for direct file URLs.'
  };
}

export const twoEmbedProvider: StreamingProvider = {
  id: '2embed',
  label: '2Embed',
  priority: 15,
  supportedMedia: ['movie', 'tv'],
  async fetchSource(context) {
    if (!context.tmdbId) return null;
    return buildTwoEmbedSource(context);
  }
};