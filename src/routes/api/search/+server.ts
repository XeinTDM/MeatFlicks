import { json, type RequestHandler } from '@sveltejs/kit';
import { withCache, buildCacheKey, CACHE_TTL_SHORT_SECONDS } from '$lib/server/cache';

// A simple schema for what a search result should look like
interface SearchResult {
	id: number;
	title: string;
	media_type: 'movie' | 'tv' | 'person';
	poster_path: string | null;
	release_date?: string; // For movies/tv
	popularity: number;
}

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');

	if (!query) {
		return json({ error: 'Search query is required' }, { status: 400 });
	}

	const cacheKey = buildCacheKey('search', 'multi', query);

	const results = await withCache(cacheKey, CACHE_TTL_SHORT_SECONDS, async () => {
		const response = await fetch(
			`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(
				query
			)}&include_adult=false&language=en-US&page=1`,
			{
				headers: {
					Authorization: `Bearer ${process.env.TMDB_API_KEY || process.env.TMDB_READ_ACCESS_TOKEN}`
				}
			}
		);

		if (!response.ok) {
			console.error(`TMDB API responded with status ${response.status}`);
			return [];
		}

		const data = await response.json();

		if (!data.results || !Array.isArray(data.results)) {
			return [];
		}

		const formattedResults: SearchResult[] = data.results
			.filter(
				(item: any) => ['movie', 'tv', 'person'].includes(item.media_type) && item.popularity > 1
			)
			.map((item: any) => {
				const posterPath = item.poster_path || item.profile_path;
				return {
					id: item.id,
					title: item.title || item.name,
					media_type: item.media_type,
					poster_path: posterPath ? `https://image.tmdb.org/t/p/w92${posterPath}` : null,
					release_date: item.release_date || item.first_air_date,
					popularity: item.popularity
				};
			})
			.sort((a: SearchResult, b: SearchResult) => b.popularity - a.popularity);

		return formattedResults.slice(0, 10);
	});

	return json(results);
};
