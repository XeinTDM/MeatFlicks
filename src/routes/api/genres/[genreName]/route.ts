import { json, type RequestHandler } from '@sveltejs/kit';
import { libraryRepository } from '$lib/server';

const DEFAULT_LIMIT = 50;

const parseNumberParam = (value: string | null): number | undefined => {
	if (!value) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return undefined;
	}

	return parsed;
};

export const GET: RequestHandler = async ({ params, url }) => {
	const { genreName } = params;

	if (!genreName) {
		return json({ error: 'Genre is required' }, { status: 400 });
	}

	const limit = parseNumberParam(url.searchParams.get('limit')) ?? DEFAULT_LIMIT;
	const offset = parseNumberParam(url.searchParams.get('offset')) ?? 0;

	try {
		const movies = await libraryRepository.findGenreMovies(genreName, limit, offset);

		if (movies.length === 0) {
			return json({ message: 'No movies found for genre: ' + genreName }, { status: 404 });
		}

		return json(movies);
	} catch (error) {
		console.error('Error fetching movies for genre ' + genreName + ':', error);
		return json({ error: 'Failed to fetch movies for genre ' + genreName }, { status: 500 });
	}
};
