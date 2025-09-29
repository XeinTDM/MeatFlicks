import { streamingConfig } from '$lib/config/streaming';
import {
	DEFAULT_EMBED_PATHS,
	DEFAULT_STREAM_PATHS,
	ensureAbsoluteUrl,
	extractFirstUrl,
	fetchWithTimeout
} from '../provider-helpers';
import type { StreamingProvider } from '../types';

const { twoEmbed } = streamingConfig;

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
	const embedUrl = `${twoEmbed.baseUrl}/embed/${context.mediaType}?${params.toString()}`;

	return {
		providerId: '2embed',
		streamUrl: embedUrl,
		embedUrl,
		reliabilityScore: 0.5,
		notes: 'Fallback to 2Embed player; consider alternate providers for higher quality.'
	} as const;
}

async function requestTwoEmbed(context: Parameters<StreamingProvider['fetchSource']>[0]) {
	const params = buildQuery(context);
	const endpoint = `${twoEmbed.baseUrl}/api/${context.mediaType}`;

	try {
		const response = await fetchWithTimeout(`${endpoint}?${params.toString()}`, {
			headers: { accept: 'application/json, text/json, */*' },
			timeoutMs: 10000
		});

		if (!response.ok) {
			throw new Error(`2Embed responded with status ${response.status}`);
		}

		const contentType = response.headers.get('content-type') ?? '';
		if (!contentType.includes('json')) {
			return fallbackSource(context, params);
		}

		const payload = await response.json();
		const streamCandidate = ensureAbsoluteUrl(
			twoEmbed.baseUrl,
			extractFirstUrl(payload, DEFAULT_STREAM_PATHS)
		);
		const embedCandidate = ensureAbsoluteUrl(
			twoEmbed.baseUrl,
			extractFirstUrl(payload, DEFAULT_EMBED_PATHS)
		);

		if (!streamCandidate && !embedCandidate) {
			return fallbackSource(context, params);
		}

		return {
			providerId: '2embed',
			streamUrl: streamCandidate ?? embedCandidate!,
			embedUrl: embedCandidate ?? undefined,
			reliabilityScore: streamCandidate ? 0.7 : 0.55,
			notes: streamCandidate
				? 'Direct stream resolved from 2Embed API.'
				: 'Embed resolved from 2Embed API.'
		} as const;
	} catch (error) {
		console.warn('[streaming][2embed]', error);
		return fallbackSource(context, params);
	}
}

export const twoEmbedProvider: StreamingProvider = {
	id: '2embed',
	label: '2Embed',
	priority: 25,
	supportedMedia: ['movie', 'tv'],
	async fetchSource(context) {
		if (!context.tmdbId) return null;
		return requestTwoEmbed(context);
	}
};
