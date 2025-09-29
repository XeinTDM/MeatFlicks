import { json, type RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
	const searchQuery = url.searchParams.get('q');

	if (!searchQuery) {
		return json({ error: 'Query parameter "q" is required' }, { status: 400 });
	}

	try {
		const movies = await prisma.$queryRaw`
			SELECT * FROM "Movie"
			WHERE similarity(title, ${searchQuery}) > 0.1 OR similarity(overview, ${searchQuery}) > 0.3
			ORDER BY greatest(similarity(title, ${searchQuery}), similarity(overview, ${searchQuery}) * 0.1) DESC
			LIMIT 100
		`;
		return json(movies);
	} catch (error) {
		console.error('Error searching movies:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
