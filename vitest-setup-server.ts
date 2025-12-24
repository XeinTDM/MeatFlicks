import { vi } from 'vitest';

vi.mock('$lib/server/logger', () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn()
	}
}));

vi.mock('$app/environment', () => ({
	dev: false,
	prod: true
}));

vi.mock('$lib/config/env', () => ({
	env: {
		TMDB_API_KEY: 'test_tmdb_key',
		TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/',
		TMDB_POSTER_SIZE: 'w500',
		TMDB_BACKDROP_SIZE: 'original',
		SQLITE_DB_PATH: 'data/meatflicks.db',
		LOG_LEVEL: 'info',
		CACHE_TTL_SHORT: 300,
		CACHE_TTL_MEDIUM: 900,
		CACHE_TTL_LONG: 1800,
		CACHE_MEMORY_MAX_ITEMS: 512,
		TMDB_STILL_SIZE: 'w300',
		PUBLIC_BASE_URL: 'http://localhost:5173',
		PUBLIC_TMDB_API_KEY: 'test_public_tmdb_key',
		PUBLIC_TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/',
		PUBLIC_TMDB_POSTER_SIZE: 'w500',
		PUBLIC_TMDB_BACKDROP_SIZE: 'original'
	}
}));
