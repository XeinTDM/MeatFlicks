import { json, type RequestHandler } from '@sveltejs/kit';
import type { MediaType } from '$lib/streaming';
import { resolveStreaming } from '$lib/server';
import { z } from 'zod';
import { validateQueryParams, tmdbIdSchema } from '$lib/server/validation';
import { errorHandler } from '$lib/server';

const streamingQueryParamsSchema = z.object({
	tmdbId: tmdbIdSchema,
	mediaType: z.enum(['movie', 'tv']),
	imdbId: z.string().optional(),
	season: z.coerce.number().int().positive().optional(),
	episode: z.coerce.number().int().positive().optional(),
	language: z.string().optional(),
	preferredQuality: z.string().optional(),
	preferredSubtitleLanguage: z.string().optional(),
	includeQualities: z
		.enum(['true', 'false'])
		.transform((val) => val === 'true')
		.optional(),
	includeSubtitles: z
		.enum(['true', 'false'])
		.transform((val) => val === 'true')
		.optional(),
	preferred: z.string().optional()
});

export const GET: RequestHandler = async ({ url }) => {
	try {
		const queryParams = validateQueryParams(streamingQueryParamsSchema, url.searchParams);

		const preferredProviders = queryParams.preferred
			? queryParams.preferred
					.split(',')
					.map((entry) => entry.trim())
					.filter(Boolean)
			: undefined;

		const input = {
			mediaType: queryParams.mediaType,
			tmdbId: queryParams.tmdbId,
			imdbId: queryParams.imdbId,
			season: queryParams.season,
			episode: queryParams.episode,
			language: queryParams.language,
			preferredQuality: queryParams.preferredQuality,
			preferredSubtitleLanguage: queryParams.preferredSubtitleLanguage,
			includeQualities: queryParams.includeQualities ?? false,
			includeSubtitles: queryParams.includeSubtitles ?? false,
			preferredProviders
		};

		const result = await resolveStreaming(input);
		return json({
			success: Boolean(result.source),
			source: result.source,
			resolutions: result.resolutions
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

import { validateRequestBody } from '$lib/server/validation';

const streamingRequestBodySchema = z.object({
	tmdbId: tmdbIdSchema,
	mediaType: z.enum(['movie', 'tv']),
	imdbId: z.string().optional(),
	season: z.number().int().positive().optional(),
	episode: z.number().int().positive().optional(),
	language: z.string().optional(),
	preferredQuality: z.string().optional(),
	preferredSubtitleLanguage: z.string().optional(),
	includeQualities: z.boolean().optional(),
	includeSubtitles: z.boolean().optional(),
	preferredProviders: z.array(z.string()).optional()
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = validateRequestBody(streamingRequestBodySchema, await request.json());

		const input = {
			mediaType: body.mediaType,
			tmdbId: body.tmdbId,
			imdbId: body.imdbId,
			season: body.season,
			episode: body.episode,
			language: body.language,
			preferredQuality: body.preferredQuality,
			preferredSubtitleLanguage: body.preferredSubtitleLanguage,
			includeQualities: body.includeQualities ?? false,
			includeSubtitles: body.includeSubtitles ?? false,
			preferredProviders: body.preferredProviders
		};

		const result = await resolveStreaming(input);
		return json({
			success: Boolean(result.source),
			source: result.source,
			resolutions: result.resolutions
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
