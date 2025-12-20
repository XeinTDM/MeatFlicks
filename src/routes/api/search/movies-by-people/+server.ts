import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { movies, moviePeople, people } from '$lib/server/db/schema';
import { sql, eq, inArray, and, or, desc, asc } from 'drizzle-orm';
import { buildCacheKey, CACHE_TTL_MEDIUM_SECONDS, withCache } from '$lib/server/cache';
import { createHash } from 'node:crypto';
import type { LibraryMovie } from '$lib/types/library';
import { mapRowsToSummaries } from '$lib/server/db/movie-select';
import type { MovieRow } from '$lib/server/db';

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
	const peopleParam = url.searchParams.get('people');
	const rolesParam = url.searchParams.get('roles');

	if (!peopleParam) {
		return json({ error: 'Query parameter "people" is required' }, { status: 400 });
	}

	const personIds = parsePersonIds(peopleParam);
	const roles = parseRoles(rolesParam);
	const limit = parseLimit(url.searchParams.get('limit'));

	if (personIds.length === 0) {
		return json({ error: 'Valid person IDs are required' }, { status: 400 });
	}

	// Create a hash for caching
	const hash = createHash('sha1')
		.update(`${personIds.join(',')}:${roles.join(',')}:${limit}`)
		.digest('hex');
	const cacheKey = buildCacheKey('search', 'movies-by-people', hash);

	try {
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
	// For now, return empty results since we don't have person data in the database yet
	// In a real implementation, this would query the local database
	// For testing purposes, we'll return an empty array

	// Build the query conditions (for future use when we have person data)
	const whereConditions = [inArray(moviePeople.personId, personIds)];

	if (roles.length > 0) {
		// Filter by specific roles (actor, director, writer, etc.)
		const roleConditions = roles.map((role) => eq(moviePeople.role, role));
		const roleOrCondition = or(...roleConditions);
		if (roleOrCondition) {
			whereConditions.push(roleOrCondition);
		}
	}

	try {
		// Query the database (this will work once we have person data)
		const query = db
			.select({
				movie: movies
			})
			.from(moviePeople)
			.innerJoin(movies, eq(moviePeople.movieId, movies.id))
			.innerJoin(people, eq(moviePeople.personId, people.id))
			.where(and(...whereConditions))
			.limit(limit)
			.groupBy(movies.id)
			.orderBy(sql`(m.rating IS NULL) ASC, m.rating DESC, m.releaseDate DESC, m.title ASC`);

		const results = await query;

		// Map to LibraryMovie format
		const movieRows = results.map((result) => result.movie);
		// Type cast to MovieRow to handle the is4K/isHD type mismatch
		return await mapRowsToSummaries(movieRows as MovieRow[]);
	} catch (error) {
		console.error('Database query failed (expected for now):', error);
		// Return empty results for now
		return [];
	}
}
