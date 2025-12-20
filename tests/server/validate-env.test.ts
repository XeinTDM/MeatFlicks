import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateEnvironment, getEnv, validateApiKeys } from '$lib/server/validate-env';
import '../../vitest-setup-server';

describe('Environment Validation', () => {
	beforeEach(() => {
		// @ts-ignore - access private variable for testing
		global.__validatedEnv = null;
	});

	it('should validate environment variables successfully', () => {
		vi.stubEnv('NODE_ENV', 'test');
		vi.stubEnv('TMDB_API_KEY', 'test_api_key');
		vi.stubEnv('TMDB_READ_ACCESS_TOKEN', 'test_token');
		const env = validateEnvironment();
		expect(env).toBeDefined();
		expect(env.TMDB_API_KEY).toBe('test_api_key');
		expect(env.TMDB_READ_ACCESS_TOKEN).toBe('test_token');
	});

	it('should throw error for missing required API keys in production', () => {
		vi.stubEnv('NODE_ENV', 'production');
		vi.stubEnv('TMDB_API_KEY', '');
		vi.stubEnv('TMDB_READ_ACCESS_TOKEN', '');
		expect(() => validateApiKeys()).toThrow();
	});

	it('should allow missing API keys in development', () => {
		vi.stubEnv('NODE_ENV', 'development');
		vi.stubEnv('TMDB_API_KEY', '');
		vi.stubEnv('TMDB_READ_ACCESS_TOKEN', '');
		expect(() => validateApiKeys()).not.toThrow();
	});

	it('should get environment variable with default value', () => {
		vi.stubEnv('NODE_ENV', 'test');
		vi.stubEnv('CACHE_TTL_MOVIE', '');
		const value = getEnv('CACHE_TTL_MOVIE', '3600');
		expect(value).toBe('3600');
	});

	it('should throw error for missing required environment variable', () => {
		vi.stubEnv('NODE_ENV', 'test');
		// @ts-ignore - clear the env variable
		delete process.env.TMDB_API_KEY;
		expect(() => getEnv('TMDB_API_KEY')).toThrow();
	});

	it('should handle numeric environment variables', () => {
		vi.stubEnv('NODE_ENV', 'test');
		vi.stubEnv('PORT', '3000');
		vi.stubEnv('CACHE_TTL_MOVIE', '1800');
		const env = validateEnvironment();
		expect(env.PORT).toBe('3000');
		expect(env.CACHE_TTL_MOVIE).toBe('1800');
	});

	it('should handle invalid URL environment variables gracefully', () => {
		vi.stubEnv('NODE_ENV', 'test');
		vi.stubEnv('VIDSRCXYZ_BASE_URL', 'invalid-url');
		const env = validateEnvironment();
		expect(env).toBeDefined();
	});
});
