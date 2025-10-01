import { env } from '$lib/config/env';
import { createTtlCache } from '$lib/server/cache';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import { ApiError, RateLimitError, safeParseApiResponse, toNumber } from '$lib/server/utils';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MOVIE_DETAILS_TTL_MS = 1000 * 60 * 10;
const TV_DETAILS_TTL_MS = MOVIE_DETAILS_TTL_MS;
const IMDB_LOOKUP_TTL_MS = 1000 * 60 * 30;
const TRENDING_CACHE_TTL_MS = 1000 * 60 * 15;

export interface TmdbMovieExtras {
	tmdbId: number;
	imdbId: string | null;
	cast: { id: number; name: string; character: string }[];
	trailerUrl: string | null;
	runtime: number | null;
	releaseDate: string | null;
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
}

const movieDetailsCache = createTtlCache<number, TmdbMovieDetails>({
	ttlMs: MOVIE_DETAILS_TTL_MS,
	maxEntries: 500
});

const tvDetailsCache = createTtlCache<number, TmdbTvDetails>({
	ttlMs: TV_DETAILS_TTL_MS,
	maxEntries: 500
});

const trendingMovieCache = createTtlCache<string, number[]>({
	ttlMs: TRENDING_CACHE_TTL_MS,
	maxEntries: 10
});

const MOVIE_LIST_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

const movieListCache = createTtlCache<string, number[]>({
	ttlMs: MOVIE_LIST_CACHE_TTL_MS,
	maxEntries: 64
});

const imdbLookupCache = createTtlCache<string, number>({
	ttlMs: IMDB_LOOKUP_TTL_MS,
	maxEntries: 2000
});

function buildUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
	const normalizedBase = TMDB_BASE_URL.endsWith('/') ? TMDB_BASE_URL : `${TMDB_BASE_URL}/`;
	const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
	const url = new URL(normalizedPath, normalizedBase);
	url.searchParams.set('api_key', env.TMDB_API_KEY);
	for (const [key, rawValue] of Object.entries(params)) {
		if (rawValue === undefined || rawValue === null || rawValue === '') continue;
		url.searchParams.set(key, String(rawValue));
	}
	return url.toString();
}

const buildImageUrl = (segment: unknown, size: string): string | null => {
	if (typeof segment !== 'string' || !segment.trim()) {
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

type MovieListRequest = {
	cacheKey: string;
	path: string;
	rateLimitKey: string;
	limit: number;
	params?: Record<string, string | number | undefined>;
};

const TMDB_PAGE_SIZE = 20;

const collectMovieIds = (
	results: Array<Record<string, unknown>> | undefined,
	limit: number,
	accumulator: number[]
): number[] => {
	if (!Array.isArray(results) || limit <= accumulator.length) {
		return accumulator;
	}

	for (const entry of results) {
		if (!entry || typeof entry !== 'object') {
			continue;
		}

		const tmdbId = toNumber((entry as Record<string, unknown>).id);
		if (typeof tmdbId === 'number' && Number.isFinite(tmdbId) && tmdbId > 0) {
			accumulator.push(tmdbId);
		}

		if (accumulator.length >= limit) {
			break;
		}
	}

	return accumulator;
};

const fetchMovieListIds = async ({
	cacheKey,
	path,
	rateLimitKey,
	limit,
	params = {}
}: MovieListRequest): Promise<number[]> => {
	const normalizedLimit = Math.max(1, Math.min(limit, 200));
	const cached = movieListCache.get(cacheKey);
	if (cached) {
		return cached.slice(0, normalizedLimit);
	}

	const ids: number[] = [];
	const totalPages = Math.ceil(normalizedLimit / TMDB_PAGE_SIZE);

	for (let page = 1; page <= totalPages; page += 1) {
		const rateLimit = await tmdbRateLimiter.checkLimit(rateLimitKey);
		if (!rateLimit.allowed) {
			throw new RateLimitError('TMDB rate limit exceeded', rateLimit.resetTime);
		}

		const endpoint = buildUrl(path, {
			language: 'en-US',
			include_adult: 'false',
			page,
			...params
		});

		const response = await fetch(endpoint);

		if (!response.ok) {
			if (response.status === 429) {
				throw new RateLimitError('TMDB API rate limited', undefined);
			}
			const message = await response.text().catch(() => response.statusText);
			throw new ApiError(`Failed to fetch TMDB list for ${path}: ${message}`, response.status);
		}

		const payload = (await response.json()) as Record<string, unknown> & {
			results?: Array<Record<string, unknown>>;
		};

		collectMovieIds(payload.results, normalizedLimit, ids);

		if (!Array.isArray(payload.results) || payload.results.length < TMDB_PAGE_SIZE) {
			break;
		}

		if (ids.length >= normalizedLimit) {
			break;
		}
	}

	movieListCache.set(cacheKey, ids.slice(0, normalizedLimit));
	return ids.slice(0, normalizedLimit);
};

const parseTmdbMovieDetails = (tmdbId: number, data: Record<string, unknown>): TmdbMovieDetails => {
	const credits = (data.credits as Record<string, unknown> | undefined)?.cast;
	const videos = (data.videos as Record<string, unknown> | undefined)?.results;

	const cast = Array.isArray(credits)
		? credits
				.slice(0, 10)
				.map((member: Record<string, unknown>) => ({
					id: toNumber(member?.id) ?? 0,
					name: String(member?.name ?? '').trim(),
					character: String(member?.character ?? '').trim()
				}))
				.filter((member) => member.id > 0 && member.name)
		: [];

	const trailer = Array.isArray(videos)
		? videos.find((video: Record<string, unknown>) => {
				if (!video || typeof video !== 'object') return false;
				const site = String(video?.site ?? '').toLowerCase();
				const type = String(video?.type ?? '').toLowerCase();
				return site === 'youtube' && (type === 'trailer' || type === 'teaser');
			})
		: undefined;

	const trailerKey =
		trailer && typeof trailer === 'object'
			? String((trailer as Record<string, unknown>).key ?? '').trim()
			: '';

	const imdbIdRaw = data.imdb_id;
	const releaseDate = typeof data.release_date === 'string' ? data.release_date : null;
	const runtime = toNumber(data.runtime) ?? null;
	const voteAverage = toNumber(data.vote_average) ?? null;

	const genres = Array.isArray(data.genres)
		? data.genres
				.map((genre) => {
					if (!genre || typeof genre !== 'object') return null;
					const record = genre as Record<string, unknown>;
					const id = toNumber(record.id);
					const name = typeof record.name === 'string' ? record.name.trim() : '';
					if (!id || !name) return null;
					return { id, name } as TmdbMovieGenre;
				})
				.filter((genre): genre is TmdbMovieGenre => Boolean(genre))
		: [];

	const title =
		typeof data.title === 'string' && data.title.trim()
			? data.title.trim()
			: typeof data.original_title === 'string' && data.original_title.trim()
				? data.original_title.trim()
				: null;

	const overview =
		typeof data.overview === 'string' && data.overview.trim() ? data.overview.trim() : null;

	const posterPath = buildImageUrl(
		(data as Record<string, unknown>).poster_path,
		env.TMDB_POSTER_SIZE
	);
	const backdropPath = buildImageUrl(
		(data as Record<string, unknown>).backdrop_path,
		env.TMDB_BACKDROP_SIZE
	);

	return {
		found: true,
		tmdbId,
		imdbId: typeof imdbIdRaw === 'string' && imdbIdRaw.trim() ? imdbIdRaw.trim() : null,
		cast,
		trailerUrl: trailerKey ? `https://www.youtube.com/embed/${trailerKey}` : null,
		runtime,
		releaseDate,
		title,
		overview,
		posterPath,
		backdropPath,
		rating: voteAverage,
		genres
	};
};

const parseTmdbTvDetails = (tmdbId: number, data: Record<string, unknown>): TmdbTvDetails => {
	const credits = (data.credits as Record<string, unknown> | undefined)?.cast;
	const videos = (data.videos as Record<string, unknown> | undefined)?.results;
	const externalIds = data.external_ids as Record<string, unknown> | undefined;

	const cast = Array.isArray(credits)
		? credits
				.slice(0, 10)
				.map((member: Record<string, unknown>) => ({
					id: toNumber(member?.id) ?? 0,
					name: String(member?.name ?? '').trim(),
					character: String(member?.character ?? '').trim()
				}))
				.filter((member) => member.id > 0 && member.name)
		: [];

	const trailer = Array.isArray(videos)
		? videos.find((video: Record<string, unknown>) => {
			if (!video || typeof video !== 'object') return false;
			const site = String(video?.site ?? '').toLowerCase();
			const type = String(video?.type ?? '').toLowerCase();
			return site === 'youtube' && (type === 'trailer' || type === 'teaser');
		})
		: undefined;

	const trailerKey =
		trailer && typeof trailer === 'object'
			? String((trailer as Record<string, unknown>).key ?? '').trim()
			: '';

	const firstAirDate = typeof data.first_air_date === 'string' ? data.first_air_date : null;
	const episodeRuntime = Array.isArray(data.episode_run_time as unknown[])
		? toNumber((data.episode_run_time as unknown[])[0])
		: toNumber(data.episode_run_time);
	const voteAverage = toNumber(data.vote_average) ?? null;
	const seasonCount = toNumber(data.number_of_seasons) ?? null;
	const episodeCount = toNumber(data.number_of_episodes) ?? null;

	const genres = Array.isArray(data.genres)
		? data.genres
				.map((genre) => {
					if (!genre || typeof genre !== 'object') return null;
					const record = genre as Record<string, unknown>;
					const id = toNumber(record.id);
					const name = typeof record.name === 'string' ? record.name.trim() : '';
					if (!id || !name) return null;
					return { id, name } as TmdbMovieGenre;
				})
				.filter((genre): genre is TmdbMovieGenre => Boolean(genre))
		: [];

	const name =
		typeof data.name === 'string' && data.name.trim()
			? data.name.trim()
			: typeof data.original_name === 'string' && data.original_name.trim()
				? data.original_name.trim()
				: null;

	const overview =
		typeof data.overview === 'string' && data.overview.trim() ? data.overview.trim() : null;

	const posterPath = buildImageUrl((data as Record<string, unknown>).poster_path, env.TMDB_POSTER_SIZE);
	const backdropPath = buildImageUrl((data as Record<string, unknown>).backdrop_path, env.TMDB_BACKDROP_SIZE);

	const imdbIdRaw = externalIds?.imdb_id;
	const imdbId = typeof imdbIdRaw === 'string' && imdbIdRaw.trim() ? imdbIdRaw.trim() : null;

	return {
		found: true,
		tmdbId,
		imdbId,
		name,
		overview,
		posterPath,
		backdropPath,
		rating: voteAverage,
		genres,
		cast,
		trailerUrl: trailerKey ? `https://www.youtube.com/embed/${trailerKey}` : null,
		episodeRuntime: episodeRuntime ?? null,
		firstAirDate,
		seasonCount,
		episodeCount
	};
};

export async function fetchTmdbTvDetails(tmdbId: number): Promise<TmdbTvDetails> {
	const cached = tvDetailsCache.get(tmdbId);
	if (cached) {
		return cached;
	}

	if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
		throw new ApiError(`A valid TMDB id is required. Received: ${tmdbId}`, 400);
	}

	const rateLimit = await tmdbRateLimiter.checkLimit('tmdb-tv-details');
	if (!rateLimit.allowed) {
		throw new RateLimitError('TMDB rate limit exceeded', rateLimit.resetTime);
	}

	const endpoint = buildUrl(`/tv/${tmdbId}`, { append_to_response: 'credits,videos,external_ids' });
	const response = await fetch(endpoint);

	if (!response.ok) {
		if (response.status === 404) {
			console.warn(`[tmdb] TV show ${tmdbId} was not found (404).`);
			const fallback: TmdbTvDetails = {
				found: false,
				tmdbId,
				imdbId: null,
				name: null,
				overview: null,
				posterPath: null,
				backdropPath: null,
				rating: null,
				genres: [],
				cast: [],
				trailerUrl: null,
				episodeRuntime: null,
				firstAirDate: null,
				seasonCount: null,
				episodeCount: null
			};
			tvDetailsCache.set(tmdbId, fallback);
			return fallback;
		}

		if (response.status === 429) {
			throw new RateLimitError('TMDB API rate limited', undefined);
		}

		const message = await response.text().catch(() => response.statusText);
		throw new ApiError(`TMDB responded with status ${response.status}: ${message}`, response.status);
	}

	const payload = (await response.json()) as Record<string, unknown>;
	const parseResult = safeParseApiResponse(payload, (data) => parseTmdbTvDetails(tmdbId, data));
	if (!parseResult.success) {
		throw new ApiError(`Failed to parse TMDB response for TV ${tmdbId}: ${parseResult.error}`);
	}

	if (!parseResult.data) {
		throw new ApiError(`Invalid TMDB response data for TV ${tmdbId}`);
	}

	tvDetailsCache.set(tmdbId, parseResult.data);
	return parseResult.data;
}

export async function fetchTmdbMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
	const cached = movieDetailsCache.get(tmdbId);
	if (cached) {
		return cached;
	}

	if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
		throw new ApiError(`A valid TMDB id is required. Received: ${tmdbId}`, 400);
	}

	const rateLimit = await tmdbRateLimiter.checkLimit('tmdb-movie-details');
	if (!rateLimit.allowed) {
		throw new RateLimitError('TMDB rate limit exceeded', rateLimit.resetTime);
	}

	const endpoint = buildUrl(`/movie/${tmdbId}`, { append_to_response: 'credits,videos' });
	const response = await fetch(endpoint);

	if (!response.ok) {
		if (response.status === 404) {
			console.warn(`[tmdb] Movie ${tmdbId} was not found (404). Skipping extras.`);
			const fallback: TmdbMovieDetails = {
				found: false,
				tmdbId,
				imdbId: null,
				cast: [],
				trailerUrl: null,
				runtime: null,
				releaseDate: null,
				title: null,
				overview: null,
				posterPath: null,
				backdropPath: null,
				rating: null,
				genres: []
			};
			movieDetailsCache.set(tmdbId, fallback);
			return fallback;
		}

		if (response.status === 429) {
			throw new RateLimitError('TMDB API rate limited', undefined);
		}

		const message = await response.text().catch(() => response.statusText);
		throw new ApiError(
			`TMDB responded with status ${response.status}: ${message}`,
			response.status
		);
	}

	const payload = (await response.json()) as Record<string, unknown>;

	const parseResult = safeParseApiResponse(payload, (data) => parseTmdbMovieDetails(tmdbId, data));
	if (!parseResult.success) {
		throw new ApiError(`Failed to parse TMDB response for ${tmdbId}: ${parseResult.error}`);
	}

	if (!parseResult.data) {
		throw new ApiError(`Invalid TMDB response data for ${tmdbId}`);
	}

	movieDetailsCache.set(tmdbId, parseResult.data);
	return parseResult.data;
}


export async function fetchTrendingMovieIds(limit = 20): Promise<number[]> {
	const cacheKey = `trending-movies:${limit}`;
	const cached = trendingMovieCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const rateLimit = await tmdbRateLimiter.checkLimit('tmdb-trending');
	if (!rateLimit.allowed) {
		throw new RateLimitError('TMDB rate limit exceeded', rateLimit.resetTime);
	}

	const endpoint = buildUrl('/trending/movie/week', { language: 'en-US' });
	const response = await fetch(endpoint);

	if (!response.ok) {
		if (response.status === 429) {
			throw new RateLimitError('TMDB API rate limited', undefined);
		}
		const message = await response.text().catch(() => response.statusText);
		throw new ApiError(`Failed to fetch trending movies: ${message}`, response.status);
	}

	const payload = (await response.json()) as Record<string, unknown> & {
		results?: Array<Record<string, unknown>>;
	};

	const results = Array.isArray(payload.results) ? payload.results : [];
	const ids: number[] = [];

	for (const entry of results) {
		if (!entry || typeof entry !== 'object') continue;
		const tmdbId = toNumber((entry as Record<string, unknown>).id);
		if (typeof tmdbId === 'number' && Number.isFinite(tmdbId) && tmdbId > 0) {
			ids.push(tmdbId);
		}
		if (ids.length >= limit) break;
	}

	trendingMovieCache.set(cacheKey, ids);
	return ids;
}

export async function fetchPopularMovieIds(limit = 20): Promise<number[]> {
	return fetchMovieListIds({
		cacheKey: `popular-movies:${limit}`,
		path: '/movie/popular',
		rateLimitKey: 'tmdb-popular',
		limit,
		params: {
			region: 'US'
		}
	});
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

	const params: Record<string, string | number | undefined> = {
		with_genres: genreId,
		'sort_by': sortBy,
		'vote_average.gte': minVoteAverage,
		'vote_count.gte': minVoteCount,
		language,
		'primary_release_date.gte': releaseDateGte,
		'primary_release_date.lte': releaseDateLte
	};

	const normalizedKeySegments = [
		genreId ?? 'all',
		limit,
		minVoteAverage,
		minVoteCount,
		sortBy,
		language,
		releaseDateGte ?? 'na',
		releaseDateLte ?? 'na'
	].map((segment) => String(segment));

	return fetchMovieListIds({
		cacheKey: `discover:${normalizedKeySegments.join(':')}`,
		path: '/discover/movie',
		rateLimitKey: 'tmdb-discover',
		limit,
		params
	});
}

export async function fetchTmdbMovieExtras(tmdbId: number): Promise<TmdbMovieExtras> {
	const details = await fetchTmdbMovieDetails(tmdbId);

	if (!details.found) {
		return {
			tmdbId,
			imdbId: null,
			cast: [],
			trailerUrl: null,
			runtime: null,
			releaseDate: null
		};
	}

	return {
		tmdbId: details.tmdbId,
		imdbId: details.imdbId,
		cast: details.cast,
		trailerUrl: details.trailerUrl,
		runtime: details.runtime,
		releaseDate: details.releaseDate
	};
}

export async function lookupTmdbIdByImdbId(imdbId: string): Promise<number | null> {
	const normalized = imdbId.trim().toLowerCase();
	if (!/^tt\d+$/.test(normalized)) {
		return null;
	}

	const cached = imdbLookupCache.get(normalized);
	if (cached !== null) {
		return cached === 0 ? null : cached;
	}

	const rateLimit = await tmdbRateLimiter.checkLimit('tmdb-imdb-lookup');
	if (!rateLimit.allowed) {
		throw new RateLimitError('TMDB rate limit exceeded', rateLimit.resetTime);
	}

	const endpoint = buildUrl(`/find/${normalized}`, { external_source: 'imdb_id' });
	const response = await fetch(endpoint);

	if (!response.ok) {
		if (response.status === 429) {
			throw new RateLimitError('TMDB API rate limited', undefined);
		}
		const message = await response.text().catch(() => response.statusText);
		throw new ApiError(`Failed to resolve TMDB id for ${imdbId}: ${message}`, response.status);
	}

	const payload = (await response.json()) as Record<string, unknown>;

	const parseImdbLookup = (data: Record<string, unknown>) => {
		const movieResults = data.movie_results;
		const movieId =
			Array.isArray(movieResults) && movieResults.length > 0
				? toNumber((movieResults[0] as Record<string, unknown>)?.id)
				: null;

		if (movieId) {
			return movieId;
		}

		const tvResults = data.tv_results;
		const tvId =
			Array.isArray(tvResults) && tvResults.length > 0
				? toNumber((tvResults[0] as Record<string, unknown>)?.id)
				: null;

		return tvId;
	};

	const parseResult = safeParseApiResponse<number | null>(payload, parseImdbLookup);
	if (!parseResult.success) {
		throw new ApiError(`Failed to parse TMDB lookup response for ${imdbId}: ${parseResult.error}`);
	}

	const value = parseResult.data ?? 0;
	imdbLookupCache.set(normalized, value);
	return parseResult.data;
}

export function invalidateTmdbCaches() {
	movieDetailsCache.clear();
	imdbLookupCache.clear();
}
