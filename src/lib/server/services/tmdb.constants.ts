import { CACHE_TTL_LONG_SECONDS, CACHE_TTL_MEDIUM_SECONDS } from '$lib/server/cache';

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const DETAILS_TTL = CACHE_TTL_LONG_SECONDS;
export const LIST_TTL = CACHE_TTL_MEDIUM_SECONDS;
export const TMDB_PAGE_SIZE = 20;
