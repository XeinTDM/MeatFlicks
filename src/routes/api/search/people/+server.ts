import { json, type RequestHandler } from '@sveltejs/kit';
import { fetchTmdbPersonDetails } from '$lib/server/services/tmdb.service';
import { buildCacheKey, CACHE_TTL_MEDIUM_SECONDS, withCache } from '$lib/server/cache';
import { createHash } from 'node:crypto';

const DEFAULT_LIMIT = 10;

const normalizeQuery = (value: string) => value.trim();

const parseLimit = (value: string | null): number => {
	if (!value) {
		return DEFAULT_LIMIT;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_LIMIT;
	}

	return Math.min(parsed, DEFAULT_LIMIT);
};

const sanitizeForFts = (term: string): string => {
	const cleaned = term
		.toLowerCase()
		.replace(/[^a-z0-9\s]/gi, ' ')
		.split(/\s+/)
		.filter(Boolean);

	if (cleaned.length === 0) {
		return '';
	}

	return cleaned.map((token) => `${token}*`).join(' ');
};

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
	const searchParam = url.searchParams.get('q');

	if (!searchParam) {
		return json({ error: 'Query parameter "q" is required' }, { status: 400 });
	}

	const query = normalizeQuery(searchParam);

	if (query.length === 0) {
		return json({ error: 'Query parameter "q" cannot be empty' }, { status: 400 });
	}

	const limit = parseLimit(url.searchParams.get('limit'));
	const hash = createHash('sha1').update(query.toLowerCase()).digest('hex');
	const cacheKey = buildCacheKey('search', 'people', hash, limit);

		try {
			const results = await withCache(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				const tmdbResults = await searchTmdbPeople(query, limit);
				return tmdbResults;
			});

		return json(results);
	} catch (error) {
		console.error('Error searching people:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
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
						Authorization: `Bearer ${process.env.TMDB_API_KEY || process.env.TMDB_READ_ACCESS_TOKEN}`
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
