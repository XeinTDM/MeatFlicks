import { json, type RequestHandler } from '@sveltejs/kit';
import { buildCacheKey, CACHE_TTL_MEDIUM_SECONDS, withCache } from '$lib/server/cache';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { LibraryMedia } from '$lib/types/library';
import { validateQueryParams, movieByPeopleSchema } from '$lib/server/validation';
import { personRepository } from '$lib/server/repositories/person.repository';
import { errorHandler } from '$lib/server';

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

		const personTmdbIds = parsePersonIds(queryParams.people);
		const roles = parseRoles(queryParams.roles ?? '');
		const limit = queryParams.limit;

		if (personTmdbIds.length === 0) {
			return json({ error: 'Valid person IDs are required' }, { status: 400 });
		}

		const hash = createHash('sha1')
			.update(`${personTmdbIds.join(',')}:${roles.join(',')}:${limit}`)
			.digest('hex');
		const cacheKey = buildCacheKey('search', 'movies-by-people', hash);

		const results = await withCache(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
			const mediaItems = await searchMediaByPeople(personTmdbIds, roles, limit);
			
			// Map to LibraryMedia format
			return mediaItems.map(m => ({
				...m,
				canonicalPath: (() => {
					const type = m.mediaType || 'movie';
					const prefix = type === 'tv' ? '/tv/' : '/movie/';
					return m.tmdbId ? `${prefix}${m.tmdbId}` : `${prefix}${m.id}`;
				})(),
				releaseDate: m.releaseDate ?? null,
				durationMinutes: m.durationMinutes ?? null,
				genres: m.genres ?? []
			}));
		});

		return json(results);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

async function searchMediaByPeople(
	tmdbIds: number[],
	roles: string[],
	limit: number
): Promise<any[]> {
	try {
		// 1. Resolve TMDB IDs to Local IDs for existing people
		const localPeople = await Promise.all(
			tmdbIds.map((id) => personRepository.findPersonByTmdbId(id))
		);
		const existingLocalIds = localPeople
			.filter((p): p is NonNullable<typeof p> => p !== null)
			.map((p) => p.id);

		// 2. Try to get media for existing local people
		if (existingLocalIds.length > 0) {
			const localResults = await personRepository.getMoviesByPeople(existingLocalIds, roles, limit);

			if (localResults.length > 0) {
				return localResults;
			}
		}
	} catch (localError) {
		console.warn('Local person search failed, falling back to TMDB:', localError);
	}

	try {
		// 3. Sync people to ensure we have them locally
		const syncedPeople = await personRepository.syncPeople(tmdbIds);
		const allLocalIds = syncedPeople.map((p) => p.id);

		if (allLocalIds.length > 0) {
			const syncedResults = await personRepository.getMoviesByPeople(allLocalIds, roles, limit);

			if (syncedResults.length > 0) {
				return syncedResults;
			}
		}

		// 4. Fallback to TMDB API search
		try {
			const { searchTmdbMoviesByPeople } = await import('$lib/server/services/tmdb.service');
			const tmdbResults = await searchTmdbMoviesByPeople(tmdbIds, roles, limit);
			return tmdbResults;
		} catch (tmdbError) {
			console.error('TMDB search failed:', tmdbError);
			return [];
		}
	} catch (error) {
		console.error('Error searching media by people:', error);
		return [];
	}
}
