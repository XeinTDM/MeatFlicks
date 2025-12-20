import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { watchlistRepository } from '$lib/server/repositories/watchlist.repository';
import { z } from 'zod';
import { errorHandler, UnauthorizedError, ValidationError } from '$lib/server';

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

		if (!session || !user) {
			throw new UnauthorizedError();
		}

		const movies = await watchlistRepository.getWatchlist(user.id);
		return json(movies);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const session = locals.session;
		const user = locals.user;

		if (!session || !user) {
			throw new UnauthorizedError();
		}

		const body = await request.json();
		const result = z.object({ movie: movieSchema }).safeParse(body);

		if (!result.success) {
			throw new ValidationError('Invalid movie data', {
				issues: result.error.format()
			});
		}

		await watchlistRepository.addToWatchlist(user.id, result.data.movie);
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

		if (!session || !user) {
			throw new UnauthorizedError();
		}

		const body = await request.json();
		const { movieId, clearAll } = body;

		if (clearAll) {
			await watchlistRepository.clearWatchlist(user.id);
			return json({ success: true });
		}

		if (!movieId) {
			throw new ValidationError('Movie ID is required');
		}

		await watchlistRepository.removeFromWatchlist(user.id, movieId);
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

		if (!session || !user) {
			throw new UnauthorizedError();
		}

		const body = await request.json();
		const result = z.object({ movies: z.array(movieSchema) }).safeParse(body);

		if (!result.success) {
			throw new ValidationError('Invalid movies data', {
				issues: result.error.format()
			});
		}

		await watchlistRepository.replaceWatchlist(user.id, result.data.movies);
		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
