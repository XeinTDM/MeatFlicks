import type { StreamingProvider, StreamingSource } from '../types';

function buildEmbedSuSource(context: Parameters<StreamingProvider['fetchSource']>[0]): StreamingSource {
  const params = new URLSearchParams({
    tmdb: context.tmdbId.toString()
  });

  if (context.mediaType === 'tv') {
    if (context.season) params.set('season', context.season.toString());
    if (context.episode) params.set('episode', context.episode.toString());
  }

  const streamUrl = `https://embed.su/embed/${context.mediaType}?${params.toString()}`;

  return {
    providerId: 'embed-su',
    streamUrl,
    reliabilityScore: 0.5,
    notes: 'Requires fallback providers when title is missing.'
  };
}

export const embedSuProvider: StreamingProvider = {
  id: 'embed-su',
  label: 'Embed.su',
  priority: 10,
  supportedMedia: ['movie', 'tv'],
  async fetchSource(context) {
    if (!context.tmdbId) return null;
    return buildEmbedSuSource(context);
  }
};