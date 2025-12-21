import { db } from '$lib/server/db';
import { people, moviePeople, movies } from '$lib/server/db/schema';
import { eq, and, or, like, inArray, desc, asc, sql } from 'drizzle-orm';
import type { PersonRecord, MoviePersonRecord, PersonSearchResult } from '$lib/server/db/types';
import { syncPersonFromTmdb } from '$lib/server/services/person-sync.service';
import {
	CACHE_TTL_MEDIUM_SECONDS,
	CACHE_TTL_LONG_SECONDS,
	buildCacheKey,
	withCache
} from '$lib/server/cache';
import { mapRowsToSummaries } from '$lib/server/db/movie-select';
import type { MovieRow } from '$lib/server/db';
import type { LibraryMovie } from '$lib/types/library';

export interface PersonSearchParams {
	query?: string;
	limit?: number;
	offset?: number;
	department?: string;
}

export interface PersonWithMovies extends PersonRecord {
	movies: LibraryMovie[];
}

export const personRepository = {
	/**
	 * Find a person by their TMDB ID
	 */
	async findPersonByTmdbId(tmdbId: number): Promise<PersonRecord | null> {
		try {
			const cacheKey = buildCacheKey('person', 'tmdb', tmdbId);
			return await withCache<PersonRecord | null>(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
				const results = await db
					.select()
					.from(people)
					.where(eq(people.tmdbId, tmdbId))
					.limit(1);

				return results[0] ?? null;
			});
		} catch (error) {
			console.error(`Error finding person by TMDB ID ${tmdbId}:`, error);
			return null;
		}
	},

	/**
	 * Find a person by their local database ID
	 */
	async findPersonById(id: number): Promise<PersonRecord | null> {
		try {
			const cacheKey = buildCacheKey('person', 'id', id);
			return await withCache<PersonRecord | null>(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
				const results = await db
					.select()
					.from(people)
					.where(eq(people.id, id))
					.limit(1);

				return results[0] ?? null;
			});
		} catch (error) {
			console.error(`Error finding person by ID ${id}:`, error);
			return null;
		}
	},

	/**
	 * Search for people in the local database
	 */
	async searchPeople(params: PersonSearchParams = {}): Promise<PersonSearchResult[]> {
		const {
			query = '',
			limit = 10,
			offset = 0,
			department
		} = params;

		try {
			const cacheKey = buildCacheKey('people', 'search', query, limit, offset, department);
			return await withCache<PersonSearchResult[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				let queryBuilder = db
					.select()
					.from(people)
					.limit(limit)
					.offset(offset);

				if (query.trim()) {
					const searchTerm = `%${query.trim()}%`;
					queryBuilder = queryBuilder.where(
						or(
							like(people.name, searchTerm),
							like(people.placeOfBirth, searchTerm)
						)
					) as any;
				}

				if (department) {
					queryBuilder = queryBuilder.where(
						eq(people.knownForDepartment, department)
					) as any;
				}

				queryBuilder = queryBuilder.orderBy(
					desc(people.popularity),
					asc(people.name)
				) as any;

				const results = await queryBuilder;
				return results.map(person => ({
					...person,
					score: 1.0 // Basic score for local results
				}));
			});
		} catch (error) {
			console.error('Error searching people:', error);
			return [];
		}
	},

	/**
	 * Get movies associated with a person
	 */
	async getMoviesByPerson(personId: number, limit = 20, offset = 0): Promise<LibraryMovie[]> {
		try {
			const cacheKey = buildCacheKey('person', personId, 'movies', limit, offset);
			return await withCache<LibraryMovie[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				const results = await db
					.select({
						movie: movies
					})
					.from(moviePeople)
					.innerJoin(movies, eq(moviePeople.movieId, movies.id))
					.where(eq(moviePeople.personId, personId))
					.limit(limit)
					.offset(offset)
					.orderBy(
						desc(movies.rating),
						desc(movies.releaseDate),
						asc(movies.title)
					);

				const movieRows = results.map(result => result.movie);
				return await mapRowsToSummaries(movieRows as MovieRow[]);
			});
		} catch (error) {
			console.error(`Error getting movies for person ${personId}:`, error);
			return [];
		}
	},

	/**
	 * Get movies by multiple people IDs
	 */
	async getMoviesByPeople(personIds: number[], roles: string[] = [], limit = 20): Promise<LibraryMovie[]> {
		if (personIds.length === 0) {
			return [];
		}

		try {
			const cacheKey = buildCacheKey('movies', 'by-people', personIds.join(','), roles.join(','), limit);
			return await withCache<LibraryMovie[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				let query = db
					.select({
						movie: movies
					})
					.from(moviePeople)
					.innerJoin(movies, eq(moviePeople.movieId, movies.id))
					.where(inArray(moviePeople.personId, personIds))
					.limit(limit)
					.groupBy(movies.id)
					.orderBy(
						desc(movies.rating),
						desc(movies.releaseDate),
						asc(movies.title)
					);

				if (roles.length > 0) {
					query = query.where(inArray(moviePeople.role, roles)) as any;
				}

				const results = await query;
				const movieRows = results.map(result => result.movie);
				return await mapRowsToSummaries(movieRows as MovieRow[]);
			});
		} catch (error) {
			console.error(`Error getting movies by people ${personIds.join(',')}:`, error);
			return [];
		}
	},

	/**
	 * Get person with their movies
	 */
	async getPersonWithMovies(personId: number, movieLimit = 10): Promise<PersonWithMovies | null> {
		try {
			const cacheKey = buildCacheKey('person', personId, 'with-movies', movieLimit);
			return await withCache<PersonWithMovies | null>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				const person = await this.findPersonById(personId);
				if (!person) {
					return null;
				}

				const movies = await this.getMoviesByPerson(personId, movieLimit);
				return {
					...person,
					movies
				};
			});
		} catch (error) {
			console.error(`Error getting person with movies for ${personId}:`, error);
			return null;
		}
	},

	/**
	 * Sync person from TMDB and return the local record
	 */
	async syncPerson(tmdbId: number): Promise<PersonRecord | null> {
		try {
			const existingPerson = await this.findPersonByTmdbId(tmdbId);
			if (existingPerson) {
				return existingPerson;
			}

			const syncedPerson = await syncPersonFromTmdb(tmdbId);
			return syncedPerson;
		} catch (error) {
			console.error(`Error syncing person ${tmdbId}:`, error);
			return null;
		}
	},

	/**
	 * Sync multiple people from TMDB
	 */
	async syncPeople(tmdbIds: number[]): Promise<PersonRecord[]> {
		if (tmdbIds.length === 0) {
			return [];
		}

		try {
			const syncPromises = tmdbIds.map(tmdbId => this.syncPerson(tmdbId));
			const results = await Promise.all(syncPromises);
			return results.filter((person): person is PersonRecord => person !== null);
		} catch (error) {
			console.error(`Error syncing people:`, error);
			return [];
		}
	},

	/**
	 * Get all people in the database (for admin/management)
	 */
	async listAllPeople(limit = 100, offset = 0): Promise<PersonRecord[]> {
		try {
			const cacheKey = buildCacheKey('people', 'all', limit, offset);
			return await withCache<PersonRecord[]>(cacheKey, CACHE_TTL_MEDIUM_SECONDS, async () => {
				return await db
					.select()
					.from(people)
					.limit(limit)
					.offset(offset)
					.orderBy(desc(people.popularity), asc(people.name));
			});
		} catch (error) {
			console.error('Error listing all people:', error);
			return [];
		}
	},

	/**
	 * Count total people in database
	 */
	async countPeople(): Promise<number> {
		try {
			const cacheKey = buildCacheKey('people', 'count');
			return await withCache<number>(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
				const result = await db
					.select({ count: sql<number>`count(*)` })
					.from(people)
					.get();

				return result?.count || 0;
			});
		} catch (error) {
			console.error('Error counting people:', error);
			return 0;
		}
	}
};

export type PersonRepository = typeof personRepository;
