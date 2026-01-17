import { env } from '$lib/config/env';
import { buildCacheKey, withCache } from '$lib/server/cache';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import type { LibraryMovie } from '$lib/types/library';
import { ApiError } from '$lib/server/utils';
import { TmdbCreditsSchema, TmdbPersonSchema, TmdbTrendingResponseSchema } from './tmdb.schemas';
import { api, buildImageUrl } from './tmdb.client';
import { DETAILS_TTL, LIST_TTL } from './tmdb.constants';
import type { TmdbMediaCredits, TmdbPersonDetails } from './tmdb.types';

export async function fetchTmdbPersonDetails(
	personId: string | number
): Promise<TmdbPersonDetails> {
	const cacheKey = buildCacheKey('tmdb', 'person', personId);

	return withCache(cacheKey, DETAILS_TTL, async () => {
		try {
			const rawData = await tmdbRateLimiter.schedule('tmdb-person-details', () =>
				api(`/person/${personId}`, {
					query: { append_to_response: 'combined_credits,images' }
				})
			);

			const data = TmdbPersonSchema.parse(rawData);

			const credits = [
				...(data.combined_credits?.cast || []).map((c) => ({ ...c, job: 'Actor' })),
				...(data.combined_credits?.crew || [])
			]
				.filter((c) => ('vote_average' in c ? c.vote_average && c.vote_average > 0 : true))
				.sort((a, b) => {
					const dateA =
						('release_date' in a ? a.release_date : '') ||
						('first_air_date' in a ? a.first_air_date : '') ||
						'';
					const dateB =
						('release_date' in b ? b.release_date : '') ||
						('first_air_date' in b ? b.first_air_date : '') ||
						'';
					return dateB.localeCompare(dateA);
				})
				.map((c) => ({
					id: c.id,
					title: c.title || c.name || 'Untitled',
					character: 'character' in c ? c.character : undefined,
					job: 'job' in c ? c.job : undefined,
					department: 'department' in c ? c.department : undefined,
					posterPath: buildImageUrl(c.poster_path, env.TMDB_POSTER_SIZE),
					mediaType: (c.media_type as 'movie' | 'tv') || 'movie',
					year: (
						('release_date' in c ? c.release_date : '') ||
						('first_air_date' in c ? c.first_air_date : '') ||
						''
					).substring(0, 4)
				}));

			return {
				id: data.id,
				name: data.name,
				biography: data.biography || '',
				birthday: data.birthday || null,
				deathday: data.deathday || null,
				placeOfBirth: data.place_of_birth || null,
				profilePath: buildImageUrl(data.profile_path, env.TMDB_POSTER_SIZE),
				knownFor: credits,
				images: (data.images?.profiles || [])
					.map((i) => buildImageUrl(i.file_path, env.TMDB_POSTER_SIZE))
					.filter((s): s is string => s !== null)
			};
		} catch (error) {
			if (error instanceof ApiError && error.statusCode === 404) {
				throw new Error('Person not found');
			}
			throw error;
		}
	});
}

export async function searchTmdbMoviesByPeople(
	personIds: number[],
	roles: string[],
	limit: number
): Promise<LibraryMovie[]> {
	const cacheKey = buildCacheKey(
		'tmdb',
		'movies-by-people',
		personIds.join(','),
		roles.join(','),
		limit
	);

	return withCache(cacheKey, LIST_TTL, async () => {
		const params: Record<string, any> = {
			language: 'en-US',
			include_adult: 'false',
			sort_by: 'popularity.desc'
		};

		if (personIds.length > 0) {
			params.with_cast = personIds.join(',');
		}

		if (roles.length > 0) {
			params.with_crew = personIds.join(',');
		}

		const rawData = await tmdbRateLimiter.schedule('tmdb-movies-by-people', () =>
			api('/discover/movie', {
				query: params
			})
		);

		const data = TmdbTrendingResponseSchema.parse(rawData);
		const movies = data.results.slice(0, limit);
		const libraryMovies: LibraryMovie[] = [];

		for (const movie of movies) {
			const title = movie.title || movie.original_title || 'Untitled';
			const releaseDate = movie.release_date || null;

			libraryMovies.push({
				id: String(movie.id),
				tmdbId: movie.id,
				title,
				overview: movie.overview || null,
				posterPath: buildImageUrl(movie.poster_path, env.TMDB_POSTER_SIZE),
				backdropPath: buildImageUrl(movie.backdrop_path, env.TMDB_BACKDROP_SIZE),
				releaseDate,
				rating: movie.vote_average || 0,
				genres: [],
				media_type: 'movie',
				is4K: false,
				isHD: true,
				trailerUrl: null,
				imdbId: null,
				canonicalPath: `/movie/${movie.id}`,
				addedAt: null,
				mediaType: 'movie'
			});
		}

		return libraryMovies;
	});
}

export async function fetchTmdbMediaCredits(
	tmdbId: number,
	mediaType: 'movie' | 'tv' | 'anime'
): Promise<TmdbMediaCredits | null> {
	const tmdbType = mediaType === 'tv' ? 'tv' : 'movie';
	const cacheKey = buildCacheKey('tmdb', tmdbType, tmdbId, 'credits');

	return withCache(cacheKey, DETAILS_TTL, async () => {
		try {
			const rawData = await tmdbRateLimiter.schedule(`tmdb-${tmdbType}-credits`, () =>
				api(`/${tmdbType}/${tmdbId}/credits`)
			);
			const data = TmdbCreditsSchema.parse(rawData);

			return {
				cast: (data.cast || []).map((c) => ({
					id: c.id,
					name: c.name,
					character: c.character || ''
				})),
				crew: (data.crew || []).map((c) => ({
					id: c.id,
					name: c.name,
					department: c.department || '',
					job: c.job || ''
				}))
			};
		} catch (error) {
			if (error instanceof ApiError && error.statusCode === 404) {
				if (tmdbType === 'movie') {
					try {
						const rawData = await tmdbRateLimiter.schedule(`tmdb-tv-credits`, () =>
							api(`/tv/${tmdbId}/credits`)
						);
						const data = TmdbCreditsSchema.parse(rawData);
						return {
							cast: (data.cast || []).map((c) => ({
								id: c.id,
								name: c.name,
								character: c.character || ''
							})),
							crew: (data.crew || []).map((c) => ({
								id: c.id,
								name: c.name,
								department: c.department || '',
								job: c.job || ''
							}))
						};
					} catch (fallbackError) {
						if (fallbackError instanceof ApiError && fallbackError.statusCode === 404) {
							return null;
						}
						throw fallbackError;
					}
				}
				return null;
			}
			throw error;
		}
	});
}
