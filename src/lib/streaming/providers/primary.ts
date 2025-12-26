import { streamingConfig } from '$lib/config/streaming';
import {
	DEFAULT_EMBED_PATHS,
	DEFAULT_STREAM_PATHS,
	ensureAbsoluteUrl,
	extractFirstUrl,
	fetchWithTimeout
} from '../provider-helpers';
import type { StreamingProvider } from '../types';

const {
	vidsrc,
	vidsrcEmbedRu,
	vidsrcEmbedSu,
	vidsrcmeSu,
	vsrcSu
} = streamingConfig;

const VIDSRC_DOMAINS = [
	vidsrc.baseUrl,
	vidsrcEmbedRu.baseUrl,
	vidsrcEmbedSu.baseUrl,
	vidsrcmeSu.baseUrl,
	vsrcSu.baseUrl
];

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

function fallbackSource(
	context: Parameters<StreamingProvider['fetchSource']>[0],
	params: URLSearchParams
) {
	for (const domain of VIDSRC_DOMAINS) {
		const embedUrl = `${domain}/embed/${context.mediaType}?${params.toString()}`;

		return {
			providerId: 'vidsrc',
			streamUrl: embedUrl,
			embedUrl,
			reliabilityScore: 0.5,
			notes: `Fallback to public VidSrc embed player (${new URL(domain).hostname}).`
		} as const;
	}

	const embedUrl = `${vidsrc.baseUrl}/embed/${context.mediaType}?${params.toString()}`;

	return {
		providerId: 'vidsrc',
		streamUrl: embedUrl,
		embedUrl,
		reliabilityScore: 0.5,
		notes: 'Fallback to public VidSrc embed player.'
	} as const;
}

async function requestVidsrc(context: Parameters<StreamingProvider['fetchSource']>[0]) {
	const params = buildQuery(context);
	const endpoint = `${vidsrc.baseUrl}/api/${context.mediaType}`;

	const headers: Record<string, string> = {
		accept: 'application/json, text/json, */*'
	};

	if (vidsrc.apiKey) {
		headers['x-api-key'] = vidsrc.apiKey;
	}

	try {
		const response = await fetchWithTimeout(`${endpoint}?${params.toString()}`, {
			headers,
			timeoutMs: 10000
		});

		if (!response.ok) {
			throw new Error(`VidSrc responded with status ${response.status}`);
		}

		const contentType = response.headers.get('content-type') ?? '';
		if (!contentType.includes('json')) {
			return fallbackSource(context, params);
		}

		const payload = await response.json();
		const streamCandidate = ensureAbsoluteUrl(
			vidsrc.baseUrl,
			extractFirstUrl(payload, DEFAULT_STREAM_PATHS)
		);

		const embedCandidate = ensureAbsoluteUrl(
			vidsrc.baseUrl,
			extractFirstUrl(payload, DEFAULT_EMBED_PATHS)
		);

		if (!streamCandidate && !embedCandidate) {
			return fallbackSource(context, params);
		}

		return {
			providerId: 'vidsrc',
			streamUrl: streamCandidate ?? embedCandidate!,
			embedUrl: embedCandidate ?? undefined,
			reliabilityScore: streamCandidate ? 0.75 : 0.6,
			notes: streamCandidate
				? 'Direct stream resolved from VidSrc API.'
				: 'Embed resolved from VidSrc API.'
		} as const;
	} catch (error) {
		console.warn('[streaming][vidsrc]', error);
		return fallbackSource(context, params);
	}
}

export const primaryProvider: StreamingProvider = {
	id: 'vidsrc',
	label: 'VidSrc',
	priority: 30,
	supportedMedia: ['movie', 'tv'],
	async fetchSource(context) {
		if (!context.tmdbId) return null;
		return requestVidsrc(context);
	}
};
