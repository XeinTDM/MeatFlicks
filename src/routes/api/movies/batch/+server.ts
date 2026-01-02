import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { libraryRepository } from '$lib/server/repositories/library.repository';

export const GET: RequestHandler = async ({ url }) => {
    const idsParam = url.searchParams.get('ids');
    if (!idsParam) {
        return json({ movies: [] });
    }

    const ids = idsParam.split(',').filter(Boolean);
    if (ids.length === 0) {
        return json({ movies: [] });
    }

    try {
        const movies = await libraryRepository.findMoviesByIds(ids);
        return json({ movies });
    } catch (error) {
        console.error('Error fetching batch movies:', error);
        return json({ error: 'Failed to fetch movies' }, { status: 500 });
    }
};
