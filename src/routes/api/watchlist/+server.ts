import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { watchlistRepository } from '$lib/server/repositories/watchlist.repository';

import { z } from 'zod';

const movieSchema = z.object({
	id: z.string(),
	title: z.string(),
	posterPath: z.string().nullable().optional(),
	backdropPath: z.string().nullable().optional(),
	overview: z.string().nullable().optional(),
	releaseDate: z.string().nullable().optional(),
	rating: z.number().optional(),
	genres: z.array(z.any()).optional(),
	addedAt: z.string().optional()
});

export const GET: RequestHandler = async ({ locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const movies = await watchlistRepository.getWatchlist(user.id);
	return json(movies);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const result = z.object({ movie: movieSchema }).safeParse(body);

	if (!result.success) {
		return json({ error: 'Invalid movie data', details: result.error.format() }, { status: 400 });
	}

	await watchlistRepository.addToWatchlist(user.id, result.data.movie);
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const { movieId, clearAll } = body;

	if (clearAll) {
		await watchlistRepository.clearWatchlist(user.id);
		return json({ success: true });
	}

	if (!movieId) {
		return json({ error: 'Movie ID is required' }, { status: 400 });
	}

	await watchlistRepository.removeFromWatchlist(user.id, movieId);
	return json({ success: true });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const session = locals.session;
	const user = locals.user;

	if (!session || !user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const result = z.object({ movies: z.array(movieSchema) }).safeParse(body);

	if (!result.success) {
		return json({ error: 'Invalid movies data', details: result.error.format() }, { status: 400 });
	}

	await watchlistRepository.replaceWatchlist(user.id, result.data.movies);
	return json({ success: true });
};
