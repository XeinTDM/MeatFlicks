import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { libraryRepository } from '$lib/server';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const limit = parseInt(url.searchParams.get('limit') || '20', 10);
		const offset = parseInt(url.searchParams.get('offset') || '0', 10);

		// Fetch top rated movies
		const movies = await libraryRepository.findMoviesWithFilters(
			{},
			{ field: 'rating', order: 'desc' },
			{ page: Math.floor(offset / limit) + 1, pageSize: limit }
		);

		return json({ movies: movies.items, total: movies.pagination.totalItems });
	} catch (error) {
		console.error('Error fetching top rated movies:', error);
		return json({ error: 'Failed to fetch top rated movies' }, { status: 500 });
	}
};
