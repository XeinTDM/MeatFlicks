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
		// Validate query parameters using the schema
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

		// Create a hash for caching
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
	// First try to use local database data
	try {
		const localResults = await personRepository.getMoviesByPeople(personIds, roles, limit);

		// If we have local results, return them
		if (localResults.length > 0) {
			return localResults;
		}
	} catch (localError) {
		console.warn('Local person search failed, falling back to TMDB:', localError);
	}

	// If no local data, try to fetch from TMDB and sync
	try {
		// Sync the people first to ensure we have their data
		await personRepository.syncPeople(personIds);

		// Try local search again after sync
		const syncedResults = await personRepository.getMoviesByPeople(personIds, roles, limit);

		if (syncedResults.length > 0) {
			return syncedResults;
		}

		// If still no results, we need to fetch movie data for these people from TMDB
		// This would require implementing a more comprehensive TMDB integration
		// For now, return empty array as fallback
		return [];
	} catch (error) {
		console.error('Error searching movies by people:', error);
		return [];
	}
}
