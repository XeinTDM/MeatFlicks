import { json, type RequestHandler } from '@sveltejs/kit';
import { buildCacheKey, CACHE_TTL_MEDIUM_SECONDS, withCache } from '$lib/server/cache';
import { createHash } from 'node:crypto';
import { validateQueryParams, searchPeopleSchema } from '$lib/server/validation';
import { errorHandler } from '$lib/server';
import { env } from '$lib/config/env';

const normalizeQuery = (value: string) => value.trim();

export interface PersonSearchResult {
	id: number;
	tmdbId: number;
	name: string;
	profilePath: string | null;
	knownForDepartment: string | null;
	popularity: number;
	biography?: string;
	birthday?: string;
	placeOfBirth?: string;
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const queryParams = validateQueryParams(searchPeopleSchema, url.searchParams);

		const query = normalizeQuery(queryParams.query);
		const limit = queryParams.limit;
		const hash = createHash('sha1').update(query.toLowerCase()).digest('hex');
		const cacheKey = buildCacheKey('search', 'people', hash, limit);

		const results = await withCache(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
			const tmdbResults = await searchTmdbPeople(query, limit);
			return tmdbResults;
		});

		return json(results);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

async function searchTmdbPeople(query: string, limit: number): Promise<PersonSearchResult[]> {
	try {
		const response = await fetch(
			`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(
				query
			)}&include_adult=false&language=en-US&page=1`,
			{
				headers: {
					Authorization: `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`
				}
			}
		);

		if (!response.ok) {
			throw new Error(`TMDB API responded with status ${response.status}`);
		}

		const data = await response.json();

		if (!data.results || !Array.isArray(data.results)) {
			return [];
		}

		return data.results.slice(0, limit).map((person: any) => ({
			id: person.id,
			tmdbId: person.id,
			name: person.name,
			profilePath: person.profile_path
				? `https://image.tmdb.org/t/p/w185${person.profile_path}`
				: null,
			knownForDepartment: person.known_for_department || null,
			popularity: person.popularity || 0,
			biography: undefined,
			birthday: undefined,
			placeOfBirth: undefined
		}));
	} catch (error) {
		console.error('Error searching TMDB people:', error);
		return [];
	}
}
