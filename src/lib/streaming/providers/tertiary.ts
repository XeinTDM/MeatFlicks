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

function getCustomParams(context?: Parameters<StreamingProvider['fetchSource']>[0]): URLSearchParams {
	const params = new URLSearchParams({
		primaryColor: vidlink.primaryColor,
		secondaryColor: vidlink.secondaryColor,
		iconColor: vidlink.iconColor,
		icons: vidlink.icons,
		player: vidlink.player,
		title: 'false',
		poster: 'true',
		autoplay: 'false',
		nextbutton: 'false'
	});

	if (context?.startAt) {
		params.set('startAt', context.startAt.toString());
	}

	if (context?.sub_file) {
		params.set('sub_file', context.sub_file);
		if (context.sub_label) {
			params.set('sub_label', context.sub_label);
		}
	}

	return params;
}

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

	// Add customization parameters
	params.set('primaryColor', vidlink.primaryColor);
	params.set('secondaryColor', vidlink.secondaryColor);
	params.set('iconColor', vidlink.iconColor);
	params.set('icons', vidlink.icons);
	params.set('player', vidlink.player);
	params.set('title', 'false');
	params.set('poster', 'true');
	params.set('autoplay', 'false');
	params.set('nextbutton', 'false');

	params.set('watch', '1');

	return params;
}

function fallbackSource(
	context: Parameters<StreamingProvider['fetchSource']>[0],
	params: URLSearchParams
) {
	let embedUrl;
	const customParams = getCustomParams(context);

	if (context.mediaType === 'movie') {
		embedUrl = `${vidlink.baseUrl}/movie/${context.tmdbId}?${customParams.toString()}`;
	} else if (context.mediaType === 'tv') {
		embedUrl = `${vidlink.baseUrl}/tv/${context.tmdbId}/${context.season}/${context.episode}?${customParams.toString()}`;
	} else {
		embedUrl = `${vidlink.baseUrl}/player/${context.mediaType}?${params.toString()}`;
	}

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

	const endpoints = [
		`${vidlink.baseUrl}/api/${context.mediaType}`,
		`${vidlink.baseUrl}/embed/${context.mediaType}`,
		`${vidlink.baseUrl}/v1/${context.mediaType}`
	];

	const headers: Record<string, string> = {
		accept: 'application/json, text/json, */*',
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
		'Referer': vidlink.baseUrl
	};

	if (vidlink.apiKey) {
		headers['x-api-key'] = vidlink.apiKey;
	}

	try {
		for (const endpoint of endpoints) {
			try {
				const response = await fetchWithTimeout(`${endpoint}?${params.toString()}`, {
					headers,
					timeoutMs: 15000,
					redirect: 'follow'
				});

				if (!response.ok) {
					if (response.status === 403) {
						const retryHeaders = {
							...headers,
							'x-requested-with': 'XMLHttpRequest'
						};

						const retryResponse = await fetchWithTimeout(`${endpoint}?${params.toString()}`, {
							headers: retryHeaders,
							timeoutMs: 15000
						});

						if (retryResponse.ok) {
							const contentType = retryResponse.headers.get('content-type') ?? '';
							if (contentType.includes('json')) {
								const payload = await retryResponse.json();
								const streamCandidate = ensureAbsoluteUrl(
									vidlink.baseUrl,
									extractFirstUrl(payload, DEFAULT_STREAM_PATHS)
								);

								let embedCandidate = ensureAbsoluteUrl(
									vidlink.baseUrl,
									extractFirstUrl(payload, DEFAULT_EMBED_PATHS)
								);

								if (!embedCandidate) {
									const customParams = getCustomParams(context);
									if (context.mediaType === 'movie') {
										embedCandidate = `${vidlink.baseUrl}/movie/${context.tmdbId}?${customParams.toString()}`;
									} else if (context.mediaType === 'tv') {
										embedCandidate = `${vidlink.baseUrl}/tv/${context.tmdbId}/${context.season}/${context.episode}?${customParams.toString()}`;
									} else {
										embedCandidate = `${vidlink.baseUrl}/player/${context.mediaType}?${params.toString()}`;
									}
								}

								if (streamCandidate || embedCandidate) {
									return {
										providerId: 'vidlink',
										streamUrl: streamCandidate ?? embedCandidate!,
										embedUrl: embedCandidate ?? undefined,
										reliabilityScore: streamCandidate ? 0.85 : 0.65,
										notes: streamCandidate
											? 'Direct stream retrieved from Vidlink API.'
											: 'Embed stream retrieved from Vidlink API.'
									};
								}
							}
						}
					}
					continue;
				}

				const contentType = response.headers.get('content-type') ?? '';
				if (!contentType.includes('json')) {
					if (contentType.includes('html')) {
						const html = await response.text();
						const embedMatch = html.match(/https?:\/\/[^\s"']+\/embed\/[^\s"']+/);
						if (embedMatch) {
							return {
								providerId: 'vidlink',
								streamUrl: embedMatch[0],
								embedUrl: embedMatch[0],
								reliabilityScore: 0.7,
								notes: 'Embed URL extracted from HTML response.'
							};
						}
					}
					continue;
				}

				const payload = await response.json();
				const streamCandidate = ensureAbsoluteUrl(
					vidlink.baseUrl,
					extractFirstUrl(payload, DEFAULT_STREAM_PATHS)
				);

				let embedCandidate = ensureAbsoluteUrl(
					vidlink.baseUrl,
					extractFirstUrl(payload, DEFAULT_EMBED_PATHS)
				);

				if (!embedCandidate) {
					const customParams = getCustomParams(context);
					if (context.mediaType === 'movie') {
						embedCandidate = `${vidlink.baseUrl}/movie/${context.tmdbId}?${customParams.toString()}`;
					} else if (context.mediaType === 'tv') {
						embedCandidate = `${vidlink.baseUrl}/tv/${context.tmdbId}/${context.season}/${context.episode}?${customParams.toString()}`;
					} else {
						embedCandidate = `${vidlink.baseUrl}/player/${context.mediaType}?${params.toString()}`;
					}
				}

				if (streamCandidate || embedCandidate) {
					return {
						providerId: 'vidlink',
						streamUrl: streamCandidate ?? embedCandidate!,
						embedUrl: embedCandidate ?? undefined,
						reliabilityScore: streamCandidate ? 0.85 : 0.65,
						notes: streamCandidate
							? 'Direct stream retrieved from Vidlink API.'
							: 'Embed stream retrieved from Vidlink API.'
					};
				}
			} catch (endpointError) {
				console.warn(`[streaming][vidlink] Endpoint ${endpoint} failed:`, endpointError);
				continue;
			}
		}

		return fallbackSource(context, params);
	} catch (error) {
		console.warn('[streaming][vidlink]', error);
		return fallbackSource(context, params);
	}
}

export const tertiaryProvider: StreamingProvider = {
	id: 'vidlink',
	label: 'Primary',
	priority: 40,
	supportedMedia: ['movie', 'tv'],
	async fetchSource(context) {
		if (!context.tmdbId) return null;
		return requestVidlink(context);
	}
};
