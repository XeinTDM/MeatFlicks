import { json, type RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
	const { genreName } = params;

	if (!genreName) {
		return json({ error: 'Genre is required' }, { status: 400 });
	}

	try {
		const movies = await prisma.movie.findMany({
			where: {
				genres: {
					some: { name: genreName }
				}
			},
			include: { genres: true },
			orderBy: { rating: 'desc' }
		});

		if (!movies.length) {
			return json({ message: `No movies found for genre: ${genreName}` }, { status: 404 });
		}

		return json(movies);
	} catch (error) {
		console.error(`Error fetching movies for genre ${genreName}:`, error);
		return json({ error: `Failed to fetch movies for genre ${genreName}` }, { status: 500 });
	}
};
