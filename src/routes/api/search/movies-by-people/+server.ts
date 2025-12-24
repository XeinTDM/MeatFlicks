import { json, type RequestHandler } from '@sveltejs/kit';
import { buildCacheKey, CACHE_TTL_MEDIUM_SECONDS, withCache } from '$lib/server/cache';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { LibraryMovie } from '$lib/types/library';
import { validateQueryParams, movieByPeopleSchema } from '$lib/server/validation';
import { personRepository } from '$lib/server/repositories/person.repository';

const DEFAULT_LIMIT = 50;

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

const parsePersonIds = (value: string | null): number[] => {
	if (!value) {
		return [];
	}

	try {
		const ids = value
			.split(',')
			.map((id) => parseInt(id.trim()))
			.filter((id) => !isNaN(id));
		return ids;
	} catch {
		return [];
	}
};

const parseRoles = (value: string | null): string[] => {
	if (!value) {
		return [];
	}

	return value
		.split(',')
		.map((role) => role.trim())
		.filter(Boolean);
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const queryParams = validateQueryParams(
			z.object({
				people: movieByPeopleSchema.shape.people,
				roles: z.string().optional(),
				limit: z.coerce.number().int().positive().max(50).default(50)
			}),
			url.searchParams
		);

		const personIds = parsePersonIds(queryParams.people);
		const roles = parseRoles(queryParams.roles ?? '');
		const limit = queryParams.limit;

		if (personIds.length === 0) {
			return json({ error: 'Valid person IDs are required' }, { status: 400 });
		}

		const hash = createHash('sha1')
			.update(`${personIds.join(',')}:${roles.join(',')}:${limit}`)
			.digest('hex');
		const cacheKey = buildCacheKey('search', 'movies-by-people', hash);

		const results = await withCache(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
			return await searchMoviesByPeople(personIds, roles, limit);
		});

		return json(results);
	} catch (error) {
		console.error('Error searching movies by people:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};

async function searchMoviesByPeople(
	personIds: number[],
	roles: string[],
	limit: number
): Promise<LibraryMovie[]> {
	try {
		const localResults = await personRepository.getMoviesByPeople(personIds, roles, limit);

		if (localResults.length > 0) {
			return localResults;
		}
	} catch (localError) {
		console.warn('Local person search failed, falling back to TMDB:', localError);
	}

	try {
		await personRepository.syncPeople(personIds);
		const syncedResults = await personRepository.getMoviesByPeople(personIds, roles, limit);

		if (syncedResults.length > 0) {
			return syncedResults;
		}

		try {
			const { searchTmdbMoviesByPeople } = await import('$lib/server/services/tmdb.service');
			const tmdbResults = await searchTmdbMoviesByPeople(personIds, roles, limit);
			return tmdbResults;
		} catch (tmdbError) {
			console.error('TMDB search failed:', tmdbError);
			return [];
		}
	} catch (error) {
		console.error('Error searching movies by people:', error);
		return [];
	}
}
