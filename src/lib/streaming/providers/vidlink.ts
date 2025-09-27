import type { MediaType, StreamingProvider, StreamingProviderContext, StreamingSource } from '../types';

function buildVidlinkUrl(mediaType: MediaType, tmdbId: number, context: StreamingProviderContext): StreamingSource {
  const params = new URLSearchParams({
    id: tmdbId.toString()
  });

  if (mediaType === 'tv') {
    if (context.season) params.set('s', context.season.toString());
    if (context.episode) params.set('e', context.episode.toString());
  }

  const streamUrl = `https://vidlink.pro/api/${mediaType}?${params.toString()}`;
  const embedUrl = `https://vidlink.pro/player/${mediaType}?${params.toString()}`;

  return {
    providerId: 'vidlink',
    streamUrl,
    embedUrl,
    reliabilityScore: 0.7,
    notes: 'Endpoint requires upstream API key to resolve to direct sources.'
  };
}

export const vidlinkProvider: StreamingProvider = {
  id: 'vidlink',
  label: 'Vidlink',
  priority: 30,
  supportedMedia: ['movie', 'tv'],
  async fetchSource(context) {
    if (!context.tmdbId) return null;
    return buildVidlinkUrl(context.mediaType, context.tmdbId, context);
  }
};