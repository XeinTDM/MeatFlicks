import { fetchTmdbPersonDetails, fetchTmdbMediaCredits } from './tmdb.service';
import type { TmdbMediaCredits } from './tmdb.service';
import { db, executeWithRetry } from '$lib/server/db';
import { people, moviePeople } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import type { PersonRecord } from '$lib/server/db/types';

export async function syncPersonFromTmdb(tmdbId: number): Promise<PersonRecord | null> {
	const results = await syncPeopleBatch([tmdbId]);
	return results.get(tmdbId) ?? null;
}

export async function syncPeopleBatch(tmdbIds: number[]): Promise<Map<number, PersonRecord>> {
	const uniqueIds = Array.from(new Set(tmdbIds.filter((id) => id > 0)));
	const result = new Map<number, PersonRecord>();

	if (uniqueIds.length === 0) return result;

	try {
		const existingPeople = await executeWithRetry(() =>
			db.select().from(people).where(inArray(people.tmdbId, uniqueIds))
		);

		for (const p of existingPeople) {
			result.set(p.tmdbId, p as PersonRecord);
		}

		const missingIds = uniqueIds.filter((id) => !result.has(id));

		if (missingIds.length > 0) {
			const missingPeopleResults = await Promise.all(
				missingIds.map(async (id) => {
					try {
						const tmdbPerson = await fetchTmdbPersonDetails(id);
						if (!tmdbPerson) return null;

						return {
							tmdbId: tmdbPerson.id,
							name: tmdbPerson.name,
							biography: tmdbPerson.biography,
							birthday: tmdbPerson.birthday,
							deathday: tmdbPerson.deathday,
							placeOfBirth: tmdbPerson.placeOfBirth,
							profilePath: tmdbPerson.profilePath,
							popularity: tmdbPerson.popularity ?? 0,
							knownForDepartment: tmdbPerson.knownFor?.[0]?.department || null,
							createdAt: Date.now(),
							updatedAt: Date.now()
						};
					} catch (err) {
						console.error(`Failed to fetch TMDB person details for ${id}:`, err);
						return null;
					}
				})
			);

			const validMissingPeople = missingPeopleResults.filter(
				(p): p is NonNullable<typeof p> => p !== null
			);

			if (validMissingPeople.length > 0) {
				await executeWithRetry(() =>
					db.insert(people).values(validMissingPeople).onConflictDoNothing()
				);

				const newlyInserted = await executeWithRetry(() =>
					db
						.select()
						.from(people)
						.where(
							inArray(
								people.tmdbId,
								validMissingPeople.map((p) => p.tmdbId)
							)
						)
				);

				for (const p of newlyInserted) {
					result.set(p.tmdbId, p as PersonRecord);
				}
			}
		}
	} catch (error) {
		console.error(`Failed to batch sync people:`, error);
	}

	return result;
}

export async function syncMovieCast(
	mediaId: string,
	tmdbMovieId: number,
	mediaType: 'movie' | 'tv' | 'anime' = 'movie'
) {
	try {
		const credits = await fetchTmdbMediaCredits(tmdbMovieId, mediaType);

		if (!credits || !credits.cast) {
			return 0;
		}

		const castTmdbIds = credits.cast.slice(0, 10).map((c) => c.id);
		const syncedPeopleMap = await syncPeopleBatch(castTmdbIds);

		const relationships = castTmdbIds
			.map((tmdbId, index) => {
				const person = syncedPeopleMap.get(tmdbId);
				if (!person) return null;

				const castMember = credits.cast.find((c) => c.id === tmdbId);
				return {
					mediaId,
					personId: person.id,
					role: 'actor' as const,
					character: castMember?.character || null,
					order: index,
					createdAt: Date.now()
				};
			})
			.filter((r): r is NonNullable<typeof r> => r !== null);

		if (relationships.length > 0) {
			await executeWithRetry(() =>
				db.insert(moviePeople).values(relationships).onConflictDoNothing()
			);
		}

		return relationships.length;
	} catch (error) {
		console.error(`Failed to sync cast for media ${mediaId}:`, error);
		return 0;
	}
}

export async function syncMovieCrew(
	mediaId: string,
	tmdbMovieId: number,
	mediaType: 'movie' | 'tv' | 'anime' = 'movie'
) {
	try {
		const credits = await fetchTmdbMediaCredits(tmdbMovieId, mediaType);

		if (!credits || !credits.crew) {
			return 0;
		}

		const relevantCrew = credits.crew
			.filter((member) =>
				['directing', 'writing', 'production', 'editing', 'sound', 'art'].includes(
					member.department?.toLowerCase() || ''
				)
			)
			.slice(0, 15);

		const crewTmdbIds = relevantCrew.map((c) => c.id);
		const syncedPeopleMap = await syncPeopleBatch(crewTmdbIds);

		const relationships = relevantCrew
			.map((crewMember) => {
				const person = syncedPeopleMap.get(crewMember.id);
				if (!person) return null;

				const role = determineCrewRole(crewMember);
				if (!role) return null;

				return {
					mediaId,
					personId: person.id,
					role,
					job: crewMember?.job || role,
					createdAt: Date.now()
				};
			})
			.filter((r): r is NonNullable<typeof r> => r !== null);

		if (relationships.length > 0) {
			await executeWithRetry(() =>
				db.insert(moviePeople).values(relationships).onConflictDoNothing()
			);
		}

		return relationships.length;
	} catch (error) {
		console.error(`Failed to sync crew for media ${mediaId}:`, error);
		return 0;
	}
}

function determineCrewRole(crewMember?: TmdbMediaCredits['crew'][number]): string | null {
	if (!crewMember) return null;

	const dept = crewMember.department?.toLowerCase();
	const job = crewMember.job?.toLowerCase() || '';

	switch (dept) {
		case 'directing':
			return 'director';
		case 'writing':
			return job.includes('screenplay') ? 'screenplay' : 'writer';
		case 'production':
			if (job.includes('producer')) return 'producer';
			return 'production';
		case 'editing':
			return 'editor';
		case 'sound':
			return job.includes('composer') ? 'composer' : 'sound';
		case 'art':
			return job.includes('costume') ? 'costume' : 'art';
		default:
			return job || null;
	}
}
