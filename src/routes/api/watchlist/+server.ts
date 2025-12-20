import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { watchlistRepository } from '$lib/server';

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

export const GET: RequestHandler = async () => {
	const movies = await watchlistRepository.getWatchlist();
	return json(movies);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const result = z.object({ movie: movieSchema }).safeParse(body);

	if (!result.success) {
		return json({ error: 'Invalid movie data', details: result.error.format() }, { status: 400 });
	}

	await watchlistRepository.addToWatchlist(result.data.movie.id, result.data.movie);
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { movieId, clearAll } = body;

	if (clearAll) {
		await watchlistRepository.clearWatchlist();
		return json({ success: true });
	}

	if (!movieId) {
		return json({ error: 'Movie ID is required' }, { status: 400 });
	}

	await watchlistRepository.removeFromWatchlist(movieId);
	return json({ success: true });
};

export const PUT: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const result = z.object({ movies: z.array(movieSchema) }).safeParse(body);

	if (!result.success) {
		return json({ error: 'Invalid movies data', details: result.error.format() }, { status: 400 });
	}

	await watchlistRepository.replaceWatchlist(result.data.movies);
	return json({ success: true });
};
