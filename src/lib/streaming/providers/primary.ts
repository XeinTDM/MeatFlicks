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
	vidsrcmeRu,
	vidsrcmeSu,
	vidsrcMeRu,
	vidsrcMeSu,
	vsrcSu
} = streamingConfig;

const VIDSRC_DOMAINS = [
	vidsrc.baseUrl,
	vidsrcEmbedRu.baseUrl,
	vidsrcEmbedSu.baseUrl,
	vidsrcmeRu.baseUrl,
	vidsrcmeSu.baseUrl,
	vidsrcMeRu.baseUrl,
	vidsrcMeSu.baseUrl,
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

	// Try multiple endpoint structures to handle API changes
	const endpoints = [
		`${vidsrc.baseUrl}/api/${context.mediaType}`,
		`${vidsrc.baseUrl}/embed/${context.mediaType}`,
		`${vidsrc.baseUrl}/v1/${context.mediaType}`,
		`${vidsrcEmbedRu.baseUrl}/api/${context.mediaType}`,
		`${vidsrcEmbedSu.baseUrl}/api/${context.mediaType}`,
		`${vidsrcmeRu.baseUrl}/api/${context.mediaType}`,
		`${vidsrcmeSu.baseUrl}/api/${context.mediaType}`,
		`${vidsrcMeRu.baseUrl}/api/${context.mediaType}`,
		`${vidsrcMeSu.baseUrl}/api/${context.mediaType}`,
		`${vsrcSu.baseUrl}/api/${context.mediaType}`
	];

	const headers: Record<string, string> = {
		accept: 'application/json, text/json, */*',
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
		Referer: vidsrc.baseUrl
	};

	if (vidsrc.apiKey) {
		headers['x-api-key'] = vidsrc.apiKey;
	}

	try {
		// Try each endpoint in sequence
		for (const endpoint of endpoints) {
			try {
				const response = await fetchWithTimeout(`${endpoint}?${params.toString()}`, {
					headers,
					timeoutMs: 15000, // Increased timeout
					redirect: 'follow'
				});

				if (!response.ok) {
					if (response.status === 404) {
						continue; // Try next endpoint for 404 errors
					} else if (response.status === 403) {
						// If we get 403, try with different headers
						const retryHeaders = {
							...headers,
							'x-requested-with': 'XMLHttpRequest'
						};

						const retryResponse = await fetchWithTimeout(`${endpoint}?${params.toString()}`, {
							headers: retryHeaders,
							timeoutMs: 15000
						});

						if (retryResponse.ok) {
							// Process the successful retry response
							const contentType = retryResponse.headers.get('content-type') ?? '';
							if (contentType.includes('json')) {
								const payload = await retryResponse.json();
								const streamCandidate = ensureAbsoluteUrl(
									vidsrc.baseUrl,
									extractFirstUrl(payload, DEFAULT_STREAM_PATHS)
								);

								const embedCandidate = ensureAbsoluteUrl(
									vidsrc.baseUrl,
									extractFirstUrl(payload, DEFAULT_EMBED_PATHS)
								);

								if (streamCandidate || embedCandidate) {
									return {
										providerId: 'vidsrc',
										streamUrl: streamCandidate ?? embedCandidate!,
										embedUrl: embedCandidate ?? undefined,
										reliabilityScore: streamCandidate ? 0.75 : 0.6,
										notes: streamCandidate
											? 'Direct stream resolved from VidSrc API.'
											: 'Embed resolved from VidSrc API.'
									} as const;
								}
							}
						}
						continue; // Try next endpoint
					} else {
						continue; // Try next endpoint for other errors
					}
				}

				const contentType = response.headers.get('content-type') ?? '';
				if (!contentType.includes('json')) {
					// If we get HTML, try to extract embed URL from it
					if (contentType.includes('html')) {
						const html = await response.text();
						const embedMatch = html.match(/https?:\/\/[^\s"']+\/embed\/[^\s"']+/);
						if (embedMatch) {
							return {
								providerId: 'vidsrc',
								streamUrl: embedMatch[0],
								embedUrl: embedMatch[0],
								reliabilityScore: 0.65,
								notes: 'Embed URL extracted from HTML response.'
							} as const;
						}
					}
					continue; // Try next endpoint
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

				if (streamCandidate || embedCandidate) {
					return {
						providerId: 'vidsrc',
						streamUrl: streamCandidate ?? embedCandidate!,
						embedUrl: embedCandidate ?? undefined,
						reliabilityScore: streamCandidate ? 0.75 : 0.6,
						notes: streamCandidate
							? 'Direct stream resolved from VidSrc API.'
							: 'Embed resolved from VidSrc API.'
					} as const;
				}
			} catch (endpointError) {
				console.warn(`[streaming][vidsrc] Endpoint ${endpoint} failed:`, endpointError);
				continue; // Try next endpoint
			}
		}

		// If all endpoints fail, return fallback
		return fallbackSource(context, params);
	} catch (error) {
		console.warn('[streaming][vidsrc]', error);
		return fallbackSource(context, params);
	}
}

export const primaryProvider: StreamingProvider = {
	id: 'vidsrc',
	label: 'Secondary',
	priority: 30,
	supportedMedia: ['movie', 'tv'],
	async fetchSource(context) {
		if (!context.tmdbId) return null;
		return requestVidsrc(context);
	}
};
