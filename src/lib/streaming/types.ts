export type MediaType = 'movie' | 'tv';

export interface StreamingProviderContext {
  mediaType: MediaType;
  tmdbId: number;
  imdbId?: string;
  season?: number;
  episode?: number;
  language?: string;
}

export interface StreamingSource {
  providerId: string;
  streamUrl: string;
  embedUrl?: string;
  reliabilityScore: number;
  notes?: string;
}

export interface StreamingProvider {
  id: string;
  label: string;
  priority: number;
  supportedMedia: MediaType[];
  fetchSource(context: StreamingProviderContext): Promise<StreamingSource | null>;
}