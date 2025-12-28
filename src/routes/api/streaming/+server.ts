import { json, type RequestHandler } from '@sveltejs/kit';
import type { MediaType } from '$lib/streaming';
import { resolveStreaming } from '$lib/server';
import { z } from 'zod';
import { validateQueryParams, tmdbIdSchema } from '$lib/server/validation';
import { errorHandler } from '$lib/server';
import { validateRequestBody } from '$lib/server/validation';

const streamingQueryParamsSchema = z.object({
	tmdbId: tmdbIdSchema,
	mediaType: z.enum(['movie', 'tv', 'anime']),
	imdbId: z.string().nullable().optional(),
	malId: z.coerce.number().int().optional(),
	subOrDub: z.enum(['sub', 'dub']).optional(),
	season: z.coerce.number().int().min(0).optional(),
	episode: z.coerce.number().int().min(0).optional(),
	language: z.string().nullable().optional(),
	preferredQuality: z.string().nullable().optional(),
	preferredSubtitleLanguage: z.string().nullable().optional(),
	includeQualities: z
		.enum(['true', 'false'])
		.transform((val) => val === 'true')
		.optional(),
	includeSubtitles: z
		.enum(['true', 'false'])
		.transform((val) => val === 'true')
		.optional(),
	preferred: z.string().optional(),
	startAt: z.coerce.number().int().min(0).optional(),
	sub_file: z.string().url().nullable().optional().or(z.literal('')),
	sub_label: z.string().nullable().optional()
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
			imdbId: queryParams.imdbId ?? undefined,
			malId: queryParams.malId,
			subOrDub: queryParams.subOrDub,
			season: queryParams.season,
			episode: queryParams.episode,
			language: queryParams.language ?? undefined,
			preferredQuality: queryParams.preferredQuality ?? undefined,
			preferredSubtitleLanguage: queryParams.preferredSubtitleLanguage ?? undefined,
			includeQualities: queryParams.includeQualities ?? false,
			includeSubtitles: queryParams.includeSubtitles ?? false,
			preferredProviders,
			startAt: queryParams.startAt,
			sub_file: queryParams.sub_file ?? undefined,
			sub_label: queryParams.sub_label ?? undefined
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

const streamingRequestBodySchema = z.object({
	tmdbId: tmdbIdSchema,
	mediaType: z.enum(['movie', 'tv', 'anime']),
	imdbId: z.string().nullable().optional(),
	malId: z.number().int().optional(),
	subOrDub: z.enum(['sub', 'dub']).optional(),
	season: z.number().int().min(0).optional(),
	episode: z.number().int().min(0).optional(),
	language: z.string().nullable().optional(),
	preferredQuality: z.string().nullable().optional(),
	preferredSubtitleLanguage: z.string().nullable().optional(),
	includeQualities: z.boolean().optional(),
	includeSubtitles: z.boolean().optional(),
	preferredProviders: z.array(z.string()).optional(),
	startAt: z.number().int().min(0).optional(),
	sub_file: z.string().url().nullable().optional().or(z.literal('')),
	sub_label: z.string().nullable().optional()
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = validateRequestBody(streamingRequestBodySchema, await request.json());

		const input = {
			mediaType: body.mediaType,
			tmdbId: body.tmdbId,
			imdbId: body.imdbId ?? undefined,
			malId: body.malId,
			subOrDub: body.subOrDub,
			season: body.season,
			episode: body.episode,
			language: body.language ?? undefined,
			preferredQuality: body.preferredQuality ?? undefined,
			preferredSubtitleLanguage: body.preferredSubtitleLanguage ?? undefined,
			includeQualities: body.includeQualities ?? false,
			includeSubtitles: body.includeSubtitles ?? false,
			preferredProviders: body.preferredProviders,
			startAt: body.startAt,
			sub_file: body.sub_file ?? undefined,
			sub_label: body.sub_label ?? undefined
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
