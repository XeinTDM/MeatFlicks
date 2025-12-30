import { fetchTmdbPersonDetails, fetchTmdbMediaCredits } from './tmdb.service';
import { db, executeWithRetry } from '$lib/server/db';
import { people, moviePeople } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function syncPersonFromTmdb(tmdbId: number) {
	try {
		const existingPerson = await executeWithRetry(() =>
			db
				.select()
				.from(people)
				.where(eq(people.tmdbId, tmdbId))
				.limit(1)
				.get()
		);

		if (existingPerson) {
			return existingPerson;
		}

		const tmdbPerson = await fetchTmdbPersonDetails(tmdbId);

		if (!tmdbPerson) {
			return null;
		}

		await executeWithRetry(() =>
			db
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
				.onConflictDoNothing()
		);

		const person = await executeWithRetry(() =>
			db.select().from(people).where(eq(people.tmdbId, tmdbId)).get()
		);

		return person ?? null;
	} catch (error) {
		console.error(`Failed to sync person ${tmdbId}:`, error);
		return null;
	}
}

export async function syncMovieCast(
	movieId: string,
	tmdbMovieId: number,
	mediaType: 'movie' | 'tv' | 'anime' = 'movie'
) {
	try {
		const credits = await fetchTmdbMediaCredits(tmdbMovieId, mediaType);

		if (!credits || !credits.cast) {
			return 0;
		}

		const castPromises = credits.cast.slice(0, 10).map(async (castMember: any) => {
			return await syncPersonFromTmdb(castMember.id);
		});

		const syncedCast = await Promise.all(castPromises);

		const relationships = syncedCast
			.filter((person): person is NonNullable<typeof person> => person !== null)
			.map((person) => {
				const castMember = credits.cast.find((c: any) => c.id === person.tmdbId);
				const index = credits.cast.findIndex((c: any) => c.id === person.tmdbId);
				return {
					movieId,
					personId: person.id!,
					role: 'actor' as const,
					character: castMember?.character || null,
					order: index >= 0 ? index : null,
					createdAt: Date.now()
				};
			});

		if (relationships.length > 0) {
			await executeWithRetry(() =>
				db.insert(moviePeople).values(relationships).onConflictDoNothing()
			);
		}

		return relationships.length;
	} catch (error) {
		console.error(`Failed to sync cast for movie ${movieId}:`, error);
		return 0;
	}
}

export async function syncMovieCrew(
	movieId: string,
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

		const syncPromises = relevantCrew.map(async (crewMember: any) => {
			return await syncPersonFromTmdb(crewMember.id);
		});

		const syncedCrew = await Promise.all(syncPromises);

		const relationships = syncedCrew
			.filter((person): person is NonNullable<typeof person> => person !== null)
			.map((person: any) => {
				const crewMember = credits.crew.find((c: any) => c.id === person.tmdbId);
				const role = determineCrewRole(crewMember);
				if (!role) return null;

				return {
					movieId,
					personId: person.id!,
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
		console.error(`Failed to sync crew for movie ${movieId}:`, error);
		return 0;
	}
}

function determineCrewRole(crewMember: any): string | null {
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
