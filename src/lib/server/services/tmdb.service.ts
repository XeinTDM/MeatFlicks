import { env } from '$lib/config/env';
import { createTtlCache } from '$lib/server/cache';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MOVIE_DETAILS_TTL_MS = 1000 * 60 * 10; // 10 minutes
const IMDB_LOOKUP_TTL_MS = 1000 * 60 * 30; // 30 minutes

export interface TmdbMovieExtras {
  tmdbId: number;
  imdbId: string | null;
  cast: { id: number; name: string; character: string }[];
  trailerUrl: string | null;
  runtime: number | null;
  releaseDate: string | null;
}

const movieExtrasCache = createTtlCache<number, TmdbMovieExtras>({
  ttlMs: MOVIE_DETAILS_TTL_MS,
  maxEntries: 500
});

const imdbLookupCache = createTtlCache<string, number>({
  ttlMs: IMDB_LOOKUP_TTL_MS,
  maxEntries: 2000
});

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

function buildUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const url = new URL(path, TMDB_BASE_URL);
  url.searchParams.set('api_key', env.TMDB_API_KEY);
  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    url.searchParams.set(key, String(rawValue));
  }
  return url.toString();
}

export async function fetchTmdbMovieExtras(tmdbId: number): Promise<TmdbMovieExtras> {
  const cached = movieExtrasCache.get(tmdbId);
  if (cached) {
    return cached;
  }

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    throw new Error(`A valid TMDB id is required. Received: ${tmdbId}`);
  }

  const endpoint = buildUrl(`/movie/${tmdbId}`, { append_to_response: 'credits,videos' });
  const response = await fetch(endpoint);

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`TMDB responded with status ${response.status}: ${message}`);
  }

  const payload: Record<string, unknown> = await response.json();

  const credits = (payload.credits as Record<string, unknown> | undefined)?.cast;
  const videos = (payload.videos as Record<string, unknown> | undefined)?.results;

  const cast = Array.isArray(credits)
    ? credits
        .slice(0, 10)
        .map((member) => ({
          id: toNumber((member as Record<string, unknown>).id) ?? 0,
          name: String((member as Record<string, unknown>).name ?? ''),
          character: String((member as Record<string, unknown>).character ?? '')
        }))
        .filter((member) => member.id > 0 && member.name)
    : [];

  const trailer = Array.isArray(videos)
    ? videos.find((video) => {
        if (!video || typeof video !== 'object') return false;
        const site = String((video as Record<string, unknown>).site ?? '').toLowerCase();
        const type = String((video as Record<string, unknown>).type ?? '').toLowerCase();
        return site === 'youtube' && type === 'trailer';
      })
    : undefined;

  const trailerKey = trailer && typeof trailer === 'object' ? String((trailer as Record<string, unknown>).key ?? '') : '';

  const imdbIdRaw = payload.imdb_id;
  const extras: TmdbMovieExtras = {
    tmdbId,
    imdbId: typeof imdbIdRaw === 'string' && imdbIdRaw.trim() ? imdbIdRaw.trim() : null,
    cast,
    trailerUrl: trailerKey ? `https://www.youtube.com/embed/${trailerKey}` : null,
    runtime: toNumber(payload.runtime) ?? null,
    releaseDate: typeof payload.release_date === 'string' ? payload.release_date : null
  };

  movieExtrasCache.set(tmdbId, extras);
  return extras;
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

  const endpoint = buildUrl(`/find/${normalized}`, { external_source: 'imdb_id' });
  const response = await fetch(endpoint);

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to resolve TMDB id for ${imdbId}: ${message}`);
  }

  const payload: Record<string, unknown> = await response.json();
  const movieResults = payload.movie_results;

  const tmdbId = Array.isArray(movieResults) && movieResults.length > 0
    ? toNumber((movieResults[0] as Record<string, unknown>).id)
    : null;

  const value = tmdbId ?? 0;
  imdbLookupCache.set(normalized, value);
  return tmdbId ?? null;
}

export function invalidateTmdbCaches() {
  movieExtrasCache.clear();
  imdbLookupCache.clear();
}
