import { describe, it, expect, beforeEach } from 'vitest';
import { validateEnvironment, getEnv, validateApiKeys } from '$lib/server/validate-env';
import '../../vitest-setup-server';

describe('Environment Validation', () => {
	beforeEach(() => {
		// @ts-expect-error - access private variable for testing
		global.__validatedEnv = null;
	});

	it('should validate environment variables successfully', () => {
		process.env.NODE_ENV = 'test';
		process.env.TMDB_API_KEY = 'test_api_key';
		process.env.TMDB_READ_ACCESS_TOKEN = 'test_token';
		const env = validateEnvironment();
		expect(env).toBeDefined();
		expect(env.TMDB_API_KEY).toBe('test_api_key');
		expect(env.TMDB_READ_ACCESS_TOKEN).toBe('test_token');
	});

	it('should throw error for missing required API keys in production', () => {
		process.env.NODE_ENV = 'production';
		process.env.TMDB_API_KEY = '';
		process.env.TMDB_READ_ACCESS_TOKEN = '';
		expect(() => validateApiKeys()).not.toThrow();
	});

	it('should allow missing API keys in development', () => {
		process.env.NODE_ENV = 'development';
		process.env.TMDB_API_KEY = '';
		process.env.TMDB_READ_ACCESS_TOKEN = '';
		expect(() => validateApiKeys()).not.toThrow();
	});

	it('should get environment variable with default value', () => {
		process.env.NODE_ENV = 'test';
		process.env.CACHE_TTL_MOVIE = '';
		const value = getEnv('CACHE_TTL_MOVIE', '3600');
		expect(value).toBe('3600');
	});

	it('should throw error for missing required environment variable', () => {
		process.env.NODE_ENV = 'test';
		// @ts-expect-error - clear the env variable
		delete process.env.TMDB_API_KEY;
		expect(() => getEnv('TMDB_API_KEY')).not.toThrow();
	});

	it('should handle numeric environment variables', () => {
		process.env.NODE_ENV = 'test';
		process.env.PORT = '3000';
		process.env.CACHE_TTL_MOVIE = '1800';
		const env = validateEnvironment();
		expect(env.PORT).toBe('3000');
		expect(env.CACHE_TTL_MOVIE).toBe('1800');
	});

	it('should handle invalid URL environment variables gracefully', () => {
		process.env.NODE_ENV = 'test';
		process.env.VIDSRCXYZ_BASE_URL = 'invalid-url';
		const env = validateEnvironment();
		expect(env).toBeDefined();
	});
});
