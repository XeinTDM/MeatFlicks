import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchTmdbTvSeason } from '$lib/server/services/tmdb.service';

export const GET: RequestHandler = async ({ params }) => {
    const id = Number(params.id);
    const seasonNumber = Number(params.number);

    if (Number.isNaN(id) || Number.isNaN(seasonNumber)) {
        return json({ error: 'Invalid parameters' }, { status: 400 });
    }

    try {
        const season = await fetchTmdbTvSeason(id, seasonNumber);
        if (!season) {
            return json({ error: 'Season not found' }, { status: 404 });
        }
        return json(season);
    } catch (error) {
        console.error('[api][tv][season] Failed to fetch season', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
