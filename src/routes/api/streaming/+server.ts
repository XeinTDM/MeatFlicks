import { json, type RequestHandler } from '@sveltejs/kit';
import type { MediaType } from '$lib/streaming';
import { resolveStreaming } from '$lib/server';

function parseInteger(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function parsePreferred(value: string | null): string[] | undefined {
	if (!value) return undefined;
	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

const buildInput = (params: URLSearchParams) => {
	const tmdbIdParam = params.get('tmdbId');
	const mediaTypeParam = params.get('mediaType') as MediaType | null;

	if (!tmdbIdParam || !mediaTypeParam) {
		return { error: 'Missing required parameters: tmdbId and mediaType.' } as const;
	}

	const tmdbId = Number(tmdbIdParam);
	if (Number.isNaN(tmdbId)) {
		return { error: 'Invalid tmdbId provided.' } as const;
	}

	if (mediaTypeParam !== 'movie' && mediaTypeParam !== 'tv') {
		return { error: 'mediaType must be either "movie" or "tv".' } as const;
	}

	const season = parseInteger(params.get('season'));
	const episode = parseInteger(params.get('episode'));
	const preferredProviders = parsePreferred(params.get('preferred'));

	return {
		mediaType: mediaTypeParam,
		tmdbId,
		imdbId: params.get('imdbId') ?? undefined,
		season,
		episode,
		language: params.get('language') ?? undefined,
		preferredQuality: params.get('preferredQuality') ?? undefined,
		preferredSubtitleLanguage: params.get('preferredSubtitleLanguage') ?? undefined,
		includeQualities: params.get('includeQualities') === 'true',
		includeSubtitles: params.get('includeSubtitles') === 'true',
		preferredProviders
	} as const;
};

export const GET: RequestHandler = async ({ url }) => {
	const input = buildInput(url.searchParams);

	if ('error' in input) {
		return json({ success: false, message: input.error }, { status: 400 });
	}

	try {
		const result = await resolveStreaming(input);
		return json({
			success: Boolean(result.source),
			source: result.source,
			resolutions: result.resolutions
		});
	} catch (error) {
		console.error('[api][streaming] Failed to resolve stream', error);
		return json(
			{ success: false, message: 'Failed to resolve streaming source.' },
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const params = new URLSearchParams();

		if (body.tmdbId) params.set('tmdbId', String(body.tmdbId));
		if (body.mediaType) params.set('mediaType', body.mediaType);
		if (body.imdbId) params.set('imdbId', body.imdbId);
		if (body.season) params.set('season', String(body.season));
		if (body.episode) params.set('episode', String(body.episode));
		if (body.language) params.set('language', body.language);
		if (body.preferredQuality) params.set('preferredQuality', body.preferredQuality);
		if (body.preferredSubtitleLanguage)
			params.set('preferredSubtitleLanguage', body.preferredSubtitleLanguage);
		if (body.includeQualities !== undefined)
			params.set('includeQualities', String(body.includeQualities));
		if (body.includeSubtitles !== undefined)
			params.set('includeSubtitles', String(body.includeSubtitles));
		if (Array.isArray(body.preferredProviders)) {
			params.set('preferred', body.preferredProviders.join(','));
		}

		const input = buildInput(params);

		if ('error' in input) {
			return json({ success: false, message: input.error }, { status: 400 });
		}

		const result = await resolveStreaming(input);
		return json({
			success: Boolean(result.source),
			source: result.source,
			resolutions: result.resolutions
		});
	} catch (error) {
		console.error('[api][streaming][POST] Failed to resolve stream', error);
		return json(
			{ success: false, message: 'Failed to resolve streaming source.' },
			{ status: 500 }
		);
	}
};
