import type { StreamingProvider, StreamingProviderContext, StreamingSource } from './types';
import { embedSuProvider } from './providers/embedSu';
import { twoEmbedProvider } from './providers/twoEmbed';
import { vidlinkProvider } from './providers/vidlink';
import { vidsrcProvider } from './providers/vidsrc';

const providers: StreamingProvider[] = [vidlinkProvider, vidsrcProvider, twoEmbedProvider, embedSuProvider].sort(
  (a, b) => b.priority - a.priority
);

export function listStreamingProviders(): StreamingProvider[] {
  return providers;
}

export async function resolveStreamingSource(
  context: StreamingProviderContext,
  preferredProviders: string[] = []
): Promise<StreamingSource | null> {
  const orderedProviders = [
    ...preferredProviders
      .map((id) => providers.find((provider) => provider.id === id))
      .filter((provider): provider is StreamingProvider => Boolean(provider)),
    ...providers.filter((provider) => !preferredProviders.includes(provider.id))
  ].filter((provider) => provider.supportedMedia.includes(context.mediaType));

  for (const provider of orderedProviders) {
    try {
      const source = await provider.fetchSource(context);
      if (source) {
        return source;
      }
    } catch (error) {
      console.warn(`Provider ${provider.id} failed to resolve stream:`, error);
    }
  }

  return null;
}