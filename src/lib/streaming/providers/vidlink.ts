import { streamingConfig } from '$lib/config/streaming';
import {
	DEFAULT_EMBED_PATHS,
	DEFAULT_STREAM_PATHS,
	ensureAbsoluteUrl,
	extractFirstUrl,
	fetchWithTimeout
} from '../provider-helpers';
import type { StreamingProvider, VideoQuality, SubtitleTrack } from '../types';
import {
	extractQualities,
	extractSubtitles,
	type QualitySource,
	type SubtitleSource
} from '../quality-helpers';

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
	let embedUrl;
	if (context.mediaType === 'movie') {
		embedUrl = `${vidlink.baseUrl}/movie/${context.tmdbId}`;
	} else if (context.mediaType === 'tv') {
		embedUrl = `${vidlink.baseUrl}/tv/${context.tmdbId}/${context.season}/${context.episode}`;
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

		let embedCandidate = ensureAbsoluteUrl(
			vidlink.baseUrl,
			extractFirstUrl(payload, DEFAULT_EMBED_PATHS)
		);

		if (!embedCandidate) {
			if (context.mediaType === 'movie') {
				embedCandidate = `${vidlink.baseUrl}/movie/${context.tmdbId}`;
			} else if (context.mediaType === 'tv') {
				embedCandidate = `${vidlink.baseUrl}/tv/${context.tmdbId}/${context.season}/${context.episode}`;
			} else {
				embedCandidate = `${vidlink.baseUrl}/player/${context.mediaType}?${params.toString()}`;
			}
		}

		if (!streamCandidate && !embedCandidate) {
			return fallbackSource(context, params);
		}

		let qualities: VideoQuality[] | undefined;
		let subtitles: SubtitleTrack[] | undefined;

		if (context.includeQualities) {
			const qualitySources: QualitySource[] = [];

			if (payload.sources && Array.isArray(payload.sources)) {
				for (const source of payload.sources) {
					if (source.url) {
						const absoluteUrl = ensureAbsoluteUrl(vidlink.baseUrl, source.url);
						if (absoluteUrl) {
							qualitySources.push({
								url: absoluteUrl,
								quality: source.quality,
								label: source.label,
								resolution: source.resolution,
								bitrate: source.bitrate
							});
						}
					}
				}
			} else if (payload.qualities && typeof payload.qualities === 'object') {
				for (const [quality, url] of Object.entries(payload.qualities)) {
					if (typeof url === 'string') {
						const absoluteUrl = ensureAbsoluteUrl(vidlink.baseUrl, url);
						if (absoluteUrl) {
							qualitySources.push({
								url: absoluteUrl,
								quality,
								label: quality
							});
						}
					}
				}
			}

			if (qualitySources.length > 1) {
				qualities = extractQualities(qualitySources);
			} else if (streamCandidate) {
				qualities = extractQualities([], streamCandidate);
			}
		}

		if (context.includeSubtitles) {
			const subtitleSources: SubtitleSource[] = [];

			if (payload.subtitles && Array.isArray(payload.subtitles)) {
				for (const subtitle of payload.subtitles) {
					if (subtitle.url && subtitle.language) {
						const absoluteUrl = ensureAbsoluteUrl(vidlink.baseUrl, subtitle.url);
						if (absoluteUrl) {
							subtitleSources.push({
								url: absoluteUrl,
								language: subtitle.language,
								label: subtitle.label
							});
						}
					}
				}
			} else if (payload.subtitles && typeof payload.subtitles === 'object') {
				for (const [language, url] of Object.entries(payload.subtitles)) {
					if (typeof url === 'string') {
						const absoluteUrl = ensureAbsoluteUrl(vidlink.baseUrl, url);
						if (absoluteUrl) {
							subtitleSources.push({
								url: absoluteUrl,
								language
							});
						}
					}
				}
			}

			if (subtitleSources.length > 0) {
				subtitles = extractSubtitles(subtitleSources);
			}
		}

		let finalStreamUrl = streamCandidate ?? embedCandidate!;
		if (qualities && context.preferredQuality) {
			const preferredUrl = qualities.find(
				(q) =>
					q.resolution.toLowerCase().includes(context.preferredQuality!.toLowerCase()) ||
					q.label.toLowerCase().includes(context.preferredQuality!.toLowerCase())
			)?.url;
			if (preferredUrl) {
				finalStreamUrl = preferredUrl;
			}
		}

		return {
			providerId: 'vidlink',
			streamUrl: finalStreamUrl,
			embedUrl: embedCandidate ?? undefined,
			reliabilityScore: streamCandidate ? 0.85 : 0.65,
			notes: streamCandidate
				? 'Direct stream retrieved from Vidlink API.'
				: 'Embed stream retrieved from Vidlink API.',
			qualities,
			subtitles
		};
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
