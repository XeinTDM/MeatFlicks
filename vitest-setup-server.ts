// Global test setup
import { beforeAll, vi } from 'vitest';

// Mock SvelteKit runtime modules for server tests
vi.mock('$app/environment', () => ({
	dev: true
}));

vi.mock('$app/stores', () => ({
	page: {
		subscribe: vi.fn(),
		set: vi.fn()
	},
	navigating: {
		subscribe: vi.fn(),
		set: vi.fn()
	},
	updated: {
		subscribe: vi.fn(),
		set: vi.fn()
	}
}));

// Mock SvelteKit navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	invalidate: vi.fn(),
	invalidateAll: vi.fn(),
	afterNavigate: vi.fn(),
	beforeNavigate: vi.fn(),
	disableScrollHandling: vi.fn(),
	preloadData: vi.fn(),
	preloadCode: vi.fn()
}));

// Mock SvelteKit env modules - must be before env config mock
vi.mock('$env/dynamic/private', () => ({
	TMDB_API_KEY: 'test-key',
	AUTH_SECRET: 'test-secret',
	NEXTAUTH_SECRET: 'test-secret',
	GITHUB_ID: 'test-id',
	GITHUB_SECRET: 'test-secret',
	LOG_LEVEL: 'silent',
	CACHE_MEMORY_MAX_ITEMS: '100',
	CACHE_TTL_SHORT: '30',
	CACHE_TTL_MEDIUM: '300',
	CACHE_TTL_LONG: '1800',
	SQLITE_DB_PATH: ':memory:'
}));

// Mock the entire env config module
vi.mock('$lib/config/env', () => ({
	env: {
		TMDB_API_KEY: 'test-key',
		TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/',
		TMDB_POSTER_SIZE: 'w500',
		TMDB_BACKDROP_SIZE: 'original',
		SQLITE_DB_PATH: ':memory:',
		LOG_LEVEL: 'silent',
		CACHE_TTL_SHORT: 300,
		CACHE_TTL_MEDIUM: 900,
		CACHE_TTL_LONG: 1800,
		CACHE_MEMORY_MAX_ITEMS: 512,
		TMDB_STILL_SIZE: 'w300'
	}
}));

// Mock database for tests that don't need real DB
vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn()
	}
}));

// Mock logger to avoid $app/environment import
vi.mock('$lib/server/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	}
}));

// Set up global mocks
beforeAll(() => {
	// Mock process.env for tests
	process.env.SQLITE_DB_PATH = ':memory:';
	process.env.TMDB_API_KEY = 'test-key';
	process.env.AUTH_SECRET = 'test-secret';
	process.env.NEXTAUTH_SECRET = 'test-secret';
	process.env.GITHUB_ID = 'test-id';
	process.env.GITHUB_SECRET = 'test-secret';
	process.env.LOG_LEVEL = 'silent';
	process.env.CACHE_MEMORY_MAX_ITEMS = '100';
	process.env.CACHE_TTL_SHORT = '30';
	process.env.CACHE_TTL_MEDIUM = '300';
	process.env.CACHE_TTL_LONG = '1800';
});
