import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchTmdbTvSeason } from '$lib/server/services/tmdb.service';
import { z } from 'zod';
import { validatePathParams } from '$lib/server/validation';
import { errorHandler } from '$lib/server';

const tvSeasonPathParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
	number: z.coerce.number().int().positive()
});

export const GET: RequestHandler = async ({ params }) => {
	try {
		// Validate path parameters
		const pathParams = validatePathParams(tvSeasonPathParamsSchema, params);

		const season = await fetchTmdbTvSeason(pathParams.id, pathParams.number);
		if (!season) {
			return json({ error: 'Season not found' }, { status: 404 });
		}
		return json(season);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
