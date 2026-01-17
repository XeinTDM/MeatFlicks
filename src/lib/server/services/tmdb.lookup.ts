import { buildCacheKey, withCache, CACHE_TTL_LONG_SECONDS } from '$lib/server/cache';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import { TmdbFindResponseSchema } from './tmdb.schemas';
import { api } from './tmdb.client';

export async function lookupTmdbIdByImdbId(imdbId: string): Promise<number | null> {
	const normalized = imdbId.trim().toLowerCase();
	if (!/^tt\d+$/.test(normalized)) {
		return null;
	}

	const cacheKey = buildCacheKey('tmdb', 'lookup', normalized);

	return withCache(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
		const rawData = await tmdbRateLimiter.schedule('tmdb-imdb-lookup', () =>
			api(`/find/${normalized}`, {
				query: { external_source: 'imdb_id' }
			})
		);

		const data = TmdbFindResponseSchema.parse(rawData);
		return data.movie_results[0]?.id || data.tv_results[0]?.id || null;
	});
}

export async function fetchMalId(title: string, year?: string): Promise<number | null> {
	const cacheKey = buildCacheKey('mal', 'search', title, year || 'any');

	return withCache(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
		try {
			const query: Record<string, string> = { q: title, limit: '1' };
			if (year) {
				const releaseYear = year.split('-')[0];
				if (releaseYear) {
					query.start_date = `${releaseYear}`;
				}
			}

			const response = await fetch(`https://api.jikan.moe/v4/anime?${new URLSearchParams(query)}`);
			if (!response.ok) {
				if (response.status === 429) {
					console.warn('[MAL] Rate limited by Jikan');
				}
				return null;
			}

			const data = await response.json();
			const result = data.data?.[0];

			if (!result) return null;

			const malTitle = (result.title || '').toLowerCase();
			if (!malTitle.includes(title.toLowerCase()) && !title.toLowerCase().includes(malTitle)) {
				console.warn(`[MAL] Title mismatch: ${title} vs ${result.title}`);
			}

			return result.mal_id || null;
		} catch (error) {
			console.warn('[MAL] Failed to fetch MAL ID', error);
			return null;
		}
	});
}
