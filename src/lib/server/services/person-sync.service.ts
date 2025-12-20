import { fetchTmdbPersonDetails } from './tmdb.service';
import { db } from '$lib/server/db';
import { people, moviePeople } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Service to sync person data from TMDB to local database
 * This allows us to have local person data for faster searches
 * while still leveraging TMDB's comprehensive data
 */

export async function syncPersonFromTmdb(tmdbId: number) {
	try {
		// Check if person already exists
		const existingPerson = await db
			.select()
			.from(people)
			.where(eq(people.tmdbId, tmdbId))
			.limit(1)
			.get();

		if (existingPerson) {
			return existingPerson;
		}

		// Fetch person details from TMDB
		const tmdbPerson = await fetchTmdbPersonDetails(tmdbId);

		if (!tmdbPerson) {
			return null;
		}

		// Insert person into local database
		const [insertedPerson] = await db
			.insert(people)
			.values({
				tmdbId: tmdbPerson.id,
				name: tmdbPerson.name,
				biography: tmdbPerson.biography,
				birthday: tmdbPerson.birthday,
				deathday: tmdbPerson.deathday,
				placeOfBirth: tmdbPerson.placeOfBirth,
				profilePath: tmdbPerson.profilePath,
				popularity: (tmdbPerson as any).popularity || 0,
				knownForDepartment: tmdbPerson.knownFor?.[0]?.department || null,
				createdAt: Date.now(),
				updatedAt: Date.now()
			})
			.returning();

		return insertedPerson;
	} catch (error) {
		console.error(`Failed to sync person ${tmdbId}:`, error);
		return null;
	}
}

/**
 * Sync movie-cast relationships from TMDB data
 */
export async function syncMovieCast(movieId: string, tmdbMovieId: number) {
	try {
		// Get movie details with cast from TMDB
		const tmdbPerson = await fetchTmdbPersonDetails(tmdbMovieId);

		if (!tmdbPerson) {
			return;
		}

		// First, ensure all cast members are in local database
		const castPromises = (tmdbPerson as any).cast?.slice(0, 10).map(async (castMember: any) => {
			return await syncPersonFromTmdb(castMember.id);
		});

		const syncedCast = await Promise.all(castPromises);

		// Then create movie-people relationships
		const relationships = syncedCast
			.filter((person: any) => person !== null)
			.map((person) => ({
				movieId,
				personId: person.id!,
				role: 'actor' as const,
				character: (tmdbPerson as any).cast?.find((c: any) => c.id === person.tmdbId)?.character,
				order: (tmdbPerson as any).cast?.find((c: any, index: number) =>
					c.id === person.tmdbId ? index : 0
				),
				createdAt: Date.now()
			}));

		if (relationships.length > 0) {
			await db.insert(moviePeople).values(relationships).onConflictDoNothing();
		}

		return relationships.length;
	} catch (error) {
		console.error(`Failed to sync cast for movie ${movieId}:`, error);
		return 0;
	}
}

/**
 * Sync movie-crew relationships (directors, writers, etc.) from TMDB data
 */
export async function syncMovieCrew(movieId: string, tmdbMovieId: number) {
	try {
		const tmdbPerson = await fetchTmdbPersonDetails(tmdbMovieId);

		if (!tmdbPerson) {
			return;
		}

		// Extract crew from knownFor (combine cast + crew for comprehensive view)
		const crewMembers = [
			...(tmdbPerson as any).cast?.slice(0, 10), // Top cast as crew
			...((tmdbPerson as any).knownFor || [])
		];

		// Sync all crew members first
		const syncPromises = crewMembers.map(async (crewMember: any) => {
			return await syncPersonFromTmdb(crewMember.id);
		});

		const syncedCrew = await Promise.all(syncPromises);

		// Create relationships for directors and key crew roles
		const relationships = syncedCrew
			.filter((person: any) => person !== null)
			.filter((person: any) => {
				const role = determineCrewRole(person.tmdbId, tmdbPerson);
				return role !== null;
			})
			.map((person: any) => {
				const role = determineCrewRole(person.tmdbId, tmdbPerson)!;
				return {
					movieId,
					personId: person.id!,
					role,
					job: role,
					createdAt: Date.now()
				};
			});

		if (relationships.length > 0) {
			await db.insert(moviePeople).values(relationships).onConflictDoNothing();
		}

		return relationships.length;
	} catch (error) {
		console.error(`Failed to sync crew for movie ${movieId}:`, error);
		return 0;
	}
}

function determineCrewRole(personTmdbId: number, tmdbPerson: any): string | null {
	// Find this person in the knownFor list to determine their role
	const crewMember = (tmdbPerson as any).knownFor?.find(
		(member: any) => member.id === personTmdbId
	);

	if (!crewMember) {
		return null;
	}

	// Map TMDB departments to our role system
	switch (crewMember.department?.toLowerCase()) {
		case 'directing':
			return 'director';
		case 'writing':
			return crewMember.job?.toLowerCase().includes('screenplay') ? 'screenplay' : 'writer';
		case 'production':
			return 'producer';
		case 'editing':
			return 'editor';
		case 'sound':
			return crewMember.job?.toLowerCase().includes('composer') ? 'composer' : 'sound';
		case 'art':
			return crewMember.job?.toLowerCase().includes('costume') ? 'costume' : 'art';
		default:
			return crewMember.job?.toLowerCase() || null;
	}
}
