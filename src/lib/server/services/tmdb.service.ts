import { env } from '$lib/config/env';
import {
	withCache,
	buildCacheKey,
	CACHE_TTL_MEDIUM_SECONDS,
	CACHE_TTL_LONG_SECONDS
} from '$lib/server/cache';
import type { LibraryMovie } from '$lib/types/library';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import { ApiError, toNumber } from '$lib/server/utils';
import { ofetch } from 'ofetch';
import {
	TmdbMovieSchema,
	TmdbTvSchema,
	TmdbTrendingResponseSchema,
	TmdbFindResponseSchema,
	TmdbTvSeasonSchema,
	TmdbRecommendationResponseSchema,
	TmdbPersonSchema
} from './tmdb.schemas';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const DETAILS_TTL = CACHE_TTL_LONG_SECONDS;
const LIST_TTL = CACHE_TTL_MEDIUM_SECONDS;

export interface TmdbMovieExtras {
	tmdbId: number;
	imdbId: string | null;
	cast: { id: number; name: string; character: string }[];
	trailerUrl: string | null;
	runtime: number | null;
	releaseDate: string | null;
	productionCompanies: { id: number; name: string; logoPath: string | null }[];
	productionCountries: { iso: string; name: string }[];
	voteCount: number | null;
}

export interface TmdbMovieGenre {
	id: number;
	name: string;
}

export interface TmdbMovieDetails extends TmdbMovieExtras {
	found: boolean;
	title: string | null;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	rating: number | null;
	genres: TmdbMovieGenre[];
}

export interface TmdbTvDetails {
	found: boolean;
	tmdbId: number;
	imdbId: string | null;
	name: string | null;
	overview: string | null;
	posterPath: string | null;
	backdropPath: string | null;
	rating: number | null;
	genres: TmdbMovieGenre[];
	cast: { id: number; name: string; character: string }[];
	trailerUrl: string | null;
	episodeRuntime: number | null;
	firstAirDate: string | null;
	seasonCount: number | null;
	episodeCount: number | null;

	seasons: TmdbTvSeason[];
	productionCompanies: { id: number; name: string; logoPath: string | null }[];
	originCountry: string[];
}

export interface TmdbTvSeason {
	id: number;
	name: string;
	overview: string | null;
	posterPath: string | null;
	seasonNumber: number;
	episodeCount: number;
	airDate: string | null;
	episodes?: TmdbTvEpisode[];
}

export interface TmdbTvEpisode {
	id: number;
	name: string;
	overview: string | null;
	episodeNumber: number;
	seasonNumber: number;
	airDate: string | null;
	stillPath: string | null;
	voteAverage: number | null;
}

export interface TmdbPersonCredit {
	id: number;
	title: string;
	character?: string;
	job?: string;
	department?: string;
	posterPath: string | null;
	mediaType: 'movie' | 'tv';
	year: string;
}

export interface TmdbPersonDetails {
	id: number;
	name: string;
	biography: string;
	birthday: string | null;
	deathday: string | null;
	placeOfBirth: string | null;
	profilePath: string | null;
	knownFor: TmdbPersonCredit[];
	images: string[];
}

const api = ofetch.create({
	baseURL: TMDB_BASE_URL,
	params: {
		api_key: env.TMDB_API_KEY
	},
	retry: 3,
	retryDelay: 1000,
	onResponseError({ response }) {
		throw new ApiError(
			`TMDB responded with status ${response.status}: ${response._data?.status_message || response.statusText}`,
			response.status
		);
	}
});

const buildImageUrl = (segment: string | null | undefined, size: string): string | null => {
	if (!segment || !segment.trim()) {
		return null;
	}

	const trimmed = segment.trim();
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed;
	}

	return `${env.TMDB_IMAGE_BASE_URL}${size}${trimmed}`;
};

export interface DiscoverMovieOptions {
	genreId?: number;
	limit?: number;
	minVoteAverage?: number;
	minVoteCount?: number;
	sortBy?: string;
	language?: string;
	releaseDateGte?: string;
	releaseDateLte?: string;
}

const TMDB_PAGE_SIZE = 20;

const fetchMovieListIds = async (
	path: string,
	params: Record<string, any>,
	limit: number,
	rateLimitKey: string
): Promise<number[]> => {
	const ids: number[] = [];
	const totalPages = Math.ceil(limit / TMDB_PAGE_SIZE);

	for (let page = 1; page <= totalPages; page++) {
		const payload = await tmdbRateLimiter.schedule(rateLimitKey, () =>
			api(path, {
				query: {
					language: 'en-US',
					include_adult: 'false',
					page,
					...params
				}
			})
		);

		const results = payload.results;
		if (!Array.isArray(results)) break;

		for (const entry of results) {
			const id = toNumber(entry.id);
			if (id) ids.push(id);
			if (ids.length >= limit) break;
		}

		if (results.length < TMDB_PAGE_SIZE || ids.length >= limit) break;
	}

	return ids;
};

export async function fetchTmdbTvDetails(tmdbId: number): Promise<TmdbTvDetails> {
	const cacheKey = buildCacheKey('tmdb', 'tv', tmdbId);

	return withCache(cacheKey, DETAILS_TTL, async () => {
		try {
			const rawData = await tmdbRateLimiter.schedule('tmdb-tv-details', () =>
				api(`/tv/${tmdbId}`, {
					query: { append_to_response: 'credits,videos,external_ids' }
				})
			);

			const data = TmdbTvSchema.parse(rawData);

			const trailer = data.videos?.results.find(
				(v) =>
					v.site.toLowerCase() === 'youtube' &&
					(v.type.toLowerCase() === 'trailer' || v.type.toLowerCase() === 'teaser')
			);

			return {
				found: true,
				tmdbId: data.id,
				imdbId: data.external_ids?.imdb_id || null,
				name: data.name || data.original_name || null,
				overview: data.overview || null,
				posterPath: buildImageUrl(data.poster_path, env.TMDB_POSTER_SIZE),
				backdropPath: buildImageUrl(data.backdrop_path, env.TMDB_BACKDROP_SIZE),
				rating: data.vote_average || null,
				genres: data.genres || [],
				cast: (data.credits?.cast || []).slice(0, 10),
				trailerUrl: trailer ? `https://www.youtube.com/embed/${trailer.key}` : null,
				episodeRuntime: data.episode_run_time?.[0] || null,
				firstAirDate: data.first_air_date || null,
				seasonCount: data.number_of_seasons || null,
				episodeCount: data.number_of_episodes || null,
				seasons: (data.seasons || [])
					.filter((s) => s.season_number > 0)
					.map((s) => ({
						id: s.id,
						name: s.name,
						overview: s.overview || null,
						posterPath: buildImageUrl(s.poster_path, env.TMDB_POSTER_SIZE),
						seasonNumber: s.season_number,
						episodeCount: s.episode_count || 0,
						airDate: s.air_date || null
					})),
				productionCompanies: (data.production_companies || []).map((c) => ({
					id: c.id,
					name: c.name,
					logoPath: buildImageUrl(c.logo_path, env.TMDB_POSTER_SIZE)
				})),
				originCountry: data.origin_country || []
			};
		} catch (error) {
			if (error instanceof ApiError && error.statusCode === 404) {
				return { found: false, tmdbId } as TmdbTvDetails;
			}
			throw error;
		}
	});
}

export async function fetchTmdbTvSeason(
	tmdbId: number,
	seasonNumber: number
): Promise<TmdbTvSeason | null> {
	const cacheKey = buildCacheKey('tmdb', 'tv', tmdbId, 'season', seasonNumber);

	return withCache(cacheKey, DETAILS_TTL, async () => {
		try {
			const rawData = await tmdbRateLimiter.schedule('tmdb-tv-season', () =>
				api(`/tv/${tmdbId}/season/${seasonNumber}`)
			);
			const data = TmdbTvSeasonSchema.parse(rawData);

			return {
				id: data.id,
				name: data.name,
				overview: data.overview || null,
				posterPath: buildImageUrl(data.poster_path, env.TMDB_POSTER_SIZE),
				seasonNumber: data.season_number,
				episodeCount: data.episode_count || 0,
				airDate: data.air_date || null,
				episodes: (data.episodes || []).map((e) => ({
					id: e.id,
					name: e.name,
					overview: e.overview || null,
					episodeNumber: e.episode_number,
					seasonNumber: e.season_number,
					airDate: e.air_date || null,
					stillPath: buildImageUrl(e.still_path, env.TMDB_STILL_SIZE || 'original'),
					voteAverage: e.vote_average || null
				}))
			};
		} catch (error) {
			if (error instanceof ApiError && error.statusCode === 404) {
				return null;
			}
			throw error;
		}
	});
}

export async function fetchTmdbMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
	const cacheKey = buildCacheKey('tmdb', 'movie', tmdbId);

	return withCache(cacheKey, DETAILS_TTL, async () => {
		try {
			const rawData = await tmdbRateLimiter.schedule('tmdb-movie-details', () =>
				api(`/movie/${tmdbId}`, {
					query: { append_to_response: 'credits,videos' }
				})
			);

			const data = TmdbMovieSchema.parse(rawData);

			const trailer = data.videos?.results.find(
				(v) =>
					v.site.toLowerCase() === 'youtube' &&
					(v.type.toLowerCase() === 'trailer' || v.type.toLowerCase() === 'teaser')
			);

			return {
				found: true,
				tmdbId: data.id,
				imdbId: data.imdb_id || null,
				cast: (data.credits?.cast || []).slice(0, 10),
				trailerUrl: trailer ? `https://www.youtube.com/embed/${trailer.key}` : null,
				runtime: data.runtime || null,
				releaseDate: data.release_date || null,
				title: data.title || data.original_title || null,
				overview: data.overview || null,
				posterPath: buildImageUrl(data.poster_path, env.TMDB_POSTER_SIZE),
				backdropPath: buildImageUrl(data.backdrop_path, env.TMDB_BACKDROP_SIZE),
				rating: data.vote_average || null,
				voteCount: data.vote_count || null,
				genres: data.genres || [],
				productionCompanies: (data.production_companies || []).map((c) => ({
					id: c.id,
					name: c.name,
					logoPath: buildImageUrl(c.logo_path, env.TMDB_POSTER_SIZE)
				})),
				productionCountries: (data.production_countries || []).map((c) => ({
					iso: c.iso_3166_1,
					name: c.name
				}))
			};
		} catch (error) {
			if (error instanceof ApiError && error.statusCode === 404) {
				return { found: false, tmdbId } as TmdbMovieDetails;
			}
			throw error;
		}
	});
}

export async function fetchTrendingMovieIds(limit = 20): Promise<number[]> {
	const cacheKey = buildCacheKey('tmdb', 'trending', limit);

	return withCache(cacheKey, LIST_TTL, async () => {
		const rawData = await tmdbRateLimiter.schedule('tmdb-trending', () =>
			api('/trending/movie/week', {
				query: { language: 'en-US' }
			})
		);

		const data = TmdbTrendingResponseSchema.parse(rawData);
		return data.results.slice(0, limit).map((r) => r.id);
	});
}

export async function fetchPopularMovieIds(limit = 20): Promise<number[]> {
	const cacheKey = buildCacheKey('tmdb', 'popular', limit);

	return withCache(cacheKey, LIST_TTL, () =>
		fetchMovieListIds('/movie/popular', { region: 'US' }, limit, 'tmdb-popular')
	);
}

export async function discoverMovieIds(options: DiscoverMovieOptions = {}): Promise<number[]> {
	const {
		genreId,
		limit = 40,
		minVoteAverage = 7,
		minVoteCount = 250,
		sortBy = 'popularity.desc',
		language = 'en-US',
		releaseDateGte,
		releaseDateLte
	} = options;

	const params = {
		with_genres: genreId,
		sort_by: sortBy,
		'vote_average.gte': minVoteAverage,
		'vote_count.gte': minVoteCount,
		language,
		'primary_release_date.gte': releaseDateGte,
		'primary_release_date.lte': releaseDateLte
	};

	const cacheKey = buildCacheKey('tmdb', 'discover', JSON.stringify(params), limit);

	return withCache(cacheKey, LIST_TTL, () =>
		fetchMovieListIds('/discover/movie', params, limit, 'tmdb-discover')
	);
}

export async function fetchTmdbMovieExtras(tmdbId: number): Promise<TmdbMovieExtras> {
	const details = await fetchTmdbMovieDetails(tmdbId);

	return {
		tmdbId: details.tmdbId,
		imdbId: details.imdbId,
		cast: details.cast,
		trailerUrl: details.trailerUrl,
		runtime: details.runtime,
		releaseDate: details.releaseDate,
		productionCompanies: details.productionCompanies,
		productionCountries: details.productionCountries,
		voteCount: details.voteCount
	};
}

export async function lookupTmdbIdByImdbId(imdbId: string): Promise<number | null> {
	const normalized = imdbId.trim().toLowerCase();
	if (!/^tt\d+$/.test(normalized)) {
		return null;
	}

	const cacheKey = buildCacheKey('tmdb', 'lookup', normalized);

	return withCache(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
		const rawData = await tmdbRateLimiter.schedule('tmdb-imdb-lookup', () =>
			api(`/find/${normalized}`, {
				query: { external_source: 'imdb_id' }
			})
		);

		const data = TmdbFindResponseSchema.parse(rawData);
		return data.movie_results[0]?.id || data.tv_results[0]?.id || null;
	});
}

/**
 * Invalidate TMDB caches matching a pattern
 * @param pattern - Pattern to match (e.g., 'tmdb:movie:*', 'tmdb:tv:123:*', 'tmdb:person:*')
 * @returns Number of cache entries invalidated
 */
export async function invalidateTmdbCaches(pattern?: string): Promise<number> {
	const { invalidateCachePattern, invalidateCachePrefix } = await import('$lib/server/cache');

	if (pattern) {
		return invalidateCachePattern(pattern);
	}

	return invalidateCachePrefix('tmdb:');
}

/**
 * Invalidate caches for a specific TMDB ID
 * @param tmdbId - TMDB ID to invalidate
 * @param mediaType - Optional media type filter
 * @returns Number of cache entries invalidated
 */
export async function invalidateTmdbId(
	tmdbId: number,
	mediaType?: 'movie' | 'tv'
): Promise<number> {
	const { invalidateTmdbId: invalidateById } = await import('$lib/server/cache');
	return invalidateById(tmdbId, mediaType);
}

export async function fetchTmdbRecommendations(
	tmdbId: number,
	mediaType: 'movie' | 'tv',
	limit = 12
): Promise<LibraryMovie[]> {
	const cacheKey = buildCacheKey('tmdb', mediaType, tmdbId, 'recommendations', limit);

	return withCache(cacheKey, LIST_TTL, async () => {
		const [similarRes, recommendRes] = await Promise.all([
			tmdbRateLimiter.schedule(`tmdb-${mediaType}-similar`, () =>
				api(`/${mediaType}/${tmdbId}/similar`, { query: { language: 'en-US', page: 1 } })
			),
			tmdbRateLimiter.schedule(`tmdb-${mediaType}-recommendations`, () =>
				api(`/${mediaType}/${tmdbId}/recommendations`, { query: { language: 'en-US', page: 1 } })
			)
		]);

		const similar = TmdbRecommendationResponseSchema.parse(similarRes).results;
		const recommended = TmdbRecommendationResponseSchema.parse(recommendRes).results;

		const combined = [...recommended, ...similar];
		const unique = new Map<number, (typeof combined)[0]>();
		for (const item of combined) {
			if (!unique.has(item.id)) {
				unique.set(item.id, item);
			}
		}

		return Array.from(unique.values())
			.slice(0, limit)
			.map((item) => {
				const title = item.title || item.name || 'Untitled';
				const releaseDate = item.release_date || item.first_air_date || null;
				const isTv = mediaType === 'tv' || item.media_type === 'tv' || Boolean(item.name);

				return {
					id: String(item.id),
					tmdbId: item.id,
					title,
					overview: null,
					posterPath: buildImageUrl(item.poster_path, env.TMDB_POSTER_SIZE),
					backdropPath: buildImageUrl(item.backdrop_path, env.TMDB_BACKDROP_SIZE),
					releaseDate,
					rating: item.vote_average || 0,
					genres: [],
					media_type: isTv ? 'tv' : 'movie',
					is4K: false,
					isHD: true,
					trailerUrl: null,
					imdbId: null,
					canonicalPath: null,
					addedAt: null,
					mediaType: isTv ? 'tv' : 'movie'
				} as LibraryMovie;
			});
	});
}

export async function fetchTmdbPersonDetails(personId: number): Promise<TmdbPersonDetails> {
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
	const cacheKey = buildCacheKey('tmdb', 'movies-by-people', personIds.join(','), roles.join(','), limit);

	return withCache(cacheKey, LIST_TTL, async () => {
		const params: Record<string, any> = {
			language: 'en-US',
			include_adult: 'false',
			sort_by: 'popularity.desc'
		};

		// Add cast parameter if we have person IDs
		if (personIds.length > 0) {
			params.with_cast = personIds.join(',');
		}

		// Add crew parameter if we have specific roles
		if (roles.length > 0) {
			params.with_crew = personIds.join(',');
			// TMDB doesn't have direct role filtering in discover, but we can filter later
		}

		const rawData = await tmdbRateLimiter.schedule('tmdb-movies-by-people', () =>
			api('/discover/movie', {
				query: params
			})
		);

		const data = TmdbTrendingResponseSchema.parse(rawData);
		const movies = data.results.slice(0, limit);

		// Convert to LibraryMovie format
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
