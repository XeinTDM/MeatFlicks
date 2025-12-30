import { streamingConfig } from '$lib/config/streaming';
import {
	DEFAULT_EMBED_PATHS,
	DEFAULT_STREAM_PATHS,
	ensureAbsoluteUrl,
	extractFirstUrl,
	fetchWithTimeout
} from '../provider-helpers';
import type { StreamingProvider } from '../types';

const { twoEmbed, hnembedCc, hnembedNet } = streamingConfig;

const HNEMBED_DOMAINS = [hnembedCc.baseUrl, hnembedNet.baseUrl];

function buildHnEmbedUrl(context: Parameters<StreamingProvider['fetchSource']>[0]): string {
	const mediaId = context.imdbId || context.tmdbId?.toString() || '';

	if (context.mediaType === 'tv') {
		if (context.season && context.episode) {
			return `${hnembedCc.baseUrl}/embed/tv/${mediaId}/${context.season}/${context.episode}`;
		}
		return `${hnembedCc.baseUrl}/embed/tv/${mediaId}/1/1`;
	}

	return `${hnembedCc.baseUrl}/embed/movie/${mediaId}`;
}

function fallbackSource(context: Parameters<StreamingProvider['fetchSource']>[0]) {
	for (const domain of HNEMBED_DOMAINS) {
		const embedUrl = buildHnEmbedUrl(context).replace(hnembedCc.baseUrl, domain);
		return {
			providerId: '2embed',
			streamUrl: embedUrl,
			embedUrl,
			reliabilityScore: 0.5,
			notes: `Fallback to HnEmbed player (${new URL(domain).hostname}).`
		} as const;
	}

	const embedUrl = `${twoEmbed.baseUrl}/embed/${context.mediaType}?tmdb=${context.tmdbId}`;
	return {
		providerId: '2embed',
		streamUrl: embedUrl,
		embedUrl,
		reliabilityScore: 0.4,
		notes: 'Fallback to legacy 2Embed player; consider alternate providers.'
	} as const;
}

async function requestTwoEmbed(context: Parameters<StreamingProvider['fetchSource']>[0]) {
	try {
		const embedUrl = buildHnEmbedUrl(context);

		const response = await fetchWithTimeout(embedUrl, {
			headers: {
				accept: 'text/html, */*',
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
				Referer: hnembedCc.baseUrl
			},
			timeoutMs: 20000
		});

		if (response.ok) {
			return {
				providerId: '2embed',
				streamUrl: embedUrl,
				embedUrl,
				reliabilityScore: 0.75,
				notes: 'Direct embed from HnEmbed.'
			} as const;
		}
	} catch (error) {
		console.warn('[streaming][2embed] HnEmbed request failed:', error);
	}

	try {
		const params = new URLSearchParams({
			tmdb: context.tmdbId?.toString() || ''
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

		const endpoint = `${twoEmbed.baseUrl}/api/${context.mediaType}`;
		const response = await fetchWithTimeout(`${endpoint}?${params.toString()}`, {
			headers: {
				accept: 'application/json, text/json, */*',
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
				Referer: twoEmbed.baseUrl
			},
			timeoutMs: 20000
		});

		if (response.ok) {
			const contentType = response.headers.get('content-type') ?? '';
			if (contentType.includes('json')) {
				const payload = await response.json();
				const streamCandidate = ensureAbsoluteUrl(
					twoEmbed.baseUrl,
					extractFirstUrl(payload, DEFAULT_STREAM_PATHS)
				);
				const embedCandidate = ensureAbsoluteUrl(
					twoEmbed.baseUrl,
					extractFirstUrl(payload, DEFAULT_EMBED_PATHS)
				);

				if (streamCandidate || embedCandidate) {
					return {
						providerId: '2embed',
						streamUrl: streamCandidate ?? embedCandidate!,
						embedUrl: embedCandidate ?? undefined,
						reliabilityScore: streamCandidate ? 0.7 : 0.6,
						notes: streamCandidate
							? 'Direct stream resolved from legacy 2Embed API.'
							: 'Embed resolved from legacy 2Embed API.'
					} as const;
				}
			}
		}
	} catch (error) {
		console.warn('[streaming][2embed] Legacy API request failed:', error);
	}

	return fallbackSource(context);
}

export const secondaryProvider: StreamingProvider = {
	id: '2embed',
	label: 'Tertiary',
	priority: 25,
	supportedMedia: ['movie', 'tv'],
	async fetchSource(context) {
		if (!context.tmdbId && !context.imdbId) return null;
		return requestTwoEmbed(context);
	}
};
