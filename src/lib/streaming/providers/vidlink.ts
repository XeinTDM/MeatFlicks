import { streamingConfig } from '$lib/config/streaming';
import {
	DEFAULT_EMBED_PATHS,
	DEFAULT_STREAM_PATHS,
	ensureAbsoluteUrl,
	extractFirstUrl,
	fetchWithTimeout
} from '../provider-helpers';
import type { StreamingProvider } from '../types';

const { vidlink } = streamingConfig;

function buildQuery(context: Parameters<StreamingProvider['fetchSource']>[0]): URLSearchParams {
	const params = new URLSearchParams({
		id: context.tmdbId.toString(),
		tmdb: context.tmdbId.toString()
	});

	if (context.imdbId) {
		params.set('imdb', context.imdbId);
	}

	if (context.mediaType === 'tv') {
		if (context.season) {
			params.set('season', context.season.toString());
			params.set('s', context.season.toString());
		}
		if (context.episode) {
			params.set('episode', context.episode.toString());
			params.set('e', context.episode.toString());
		}
	}

	if (context.language) {
		params.set('lang', context.language);
	}

	params.set('watch', '1');

	return params;
}

function fallbackSource(
	context: Parameters<StreamingProvider['fetchSource']>[0],
	params: URLSearchParams
) {
	const embedUrl = `${vidlink.baseUrl}/player/${context.mediaType}?${params.toString()}`;

	return {
		providerId: 'vidlink',
		streamUrl: embedUrl,
		embedUrl,
		reliabilityScore: 0.55,
		notes: 'Fallback to embed player; direct stream unavailable.'
	} as const;
}

async function requestVidlink(context: Parameters<StreamingProvider['fetchSource']>[0]) {
	const params = buildQuery(context);
	const endpoint = `${vidlink.baseUrl}/api/${context.mediaType}`;

	const headers: Record<string, string> = {
		accept: 'application/json, text/json, */*'
	};

	if (vidlink.apiKey) {
		headers['x-api-key'] = vidlink.apiKey;
	}

	try {
		const response = await fetchWithTimeout(`${endpoint}?${params.toString()}`, {
			headers,
			timeoutMs: 10000
		});

		if (!response.ok) {
			throw new Error(`Vidlink responded with status ${response.status}`);
		}

		const contentType = response.headers.get('content-type') ?? '';
		if (!contentType.includes('json')) {
			return fallbackSource(context, params);
		}

		const payload = await response.json();
		const streamCandidate = ensureAbsoluteUrl(
			vidlink.baseUrl,
			extractFirstUrl(payload, DEFAULT_STREAM_PATHS)
		);

		const embedCandidate =
			ensureAbsoluteUrl(vidlink.baseUrl, extractFirstUrl(payload, DEFAULT_EMBED_PATHS)) ??
			`${vidlink.baseUrl}/player/${context.mediaType}?${params.toString()}`;

		if (!streamCandidate && !embedCandidate) {
			return fallbackSource(context, params);
		}

		return {
			providerId: 'vidlink',
			streamUrl: streamCandidate ?? embedCandidate!,
			embedUrl: embedCandidate ?? undefined,
			reliabilityScore: streamCandidate ? 0.85 : 0.65,
			notes: streamCandidate
				? 'Direct stream retrieved from Vidlink API.'
				: 'Embed stream retrieved from Vidlink API.'
		} as const;
	} catch (error) {
		console.warn('[streaming][vidlink]', error);
		return fallbackSource(context, params);
	}
}

export const vidlinkProvider: StreamingProvider = {
	id: 'vidlink',
	label: 'Vidlink',
	priority: 40,
	supportedMedia: ['movie', 'tv'],
	async fetchSource(context) {
		if (!context.tmdbId) return null;
		return requestVidlink(context);
	}
};
