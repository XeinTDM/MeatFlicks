import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { watchlistRepository } from '$lib/server/repositories/watchlist.repository';
import { z } from 'zod';
import { errorHandler, UnauthorizedError, ValidationError } from '$lib/server';
import { validateRequestBody, watchlistItemSchema } from '$lib/server/validation';

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
	try {
		const session = locals.session;
		const user = locals.user;

		if (session && user) {
			const movies = await watchlistRepository.getWatchlist(user.id);
			return json(movies);
		}

		return json([]);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = locals.session;
		const user = locals.user;

		if (session && user) {
			const body = await request.json();
			const validatedBody = validateRequestBody(z.object({ movie: movieSchema }), body);

			await watchlistRepository.addToWatchlist(user.id, validatedBody.movie);
		}

		return json({ success: true });
		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	try {
		const session = locals.session;
		const user = locals.user;

		if (session && user) {
			const body = await request.json();
			const validatedBody = validateRequestBody(
				z.object({
					movieId: z.string().optional(),
					clearAll: z.boolean().optional()
				}),
				body
			);

			if (validatedBody.clearAll) {
				await watchlistRepository.clearWatchlist(user.id);
				return json({ success: true });
			}

			if (!validatedBody.movieId) {
				throw new ValidationError('Movie ID is required');
			}

			await watchlistRepository.removeFromWatchlist(user.id, validatedBody.movieId);
		}

		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	try {
		const session = locals.session;
		const user = locals.user;

		if (session && user) {
			const body = await request.json();
			const validatedBody = validateRequestBody(z.object({ movies: z.array(movieSchema) }), body);

			await watchlistRepository.replaceWatchlist(user.id, validatedBody.movies);
		}

		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
