function getPrivateEnv() {
	return {
		DATABASE_URL: process.env.DATABASE_URL,
		DATABASE_PATH: process.env.DATABASE_PATH,
		TMDB_API_KEY: process.env.TMDB_API_KEY,
		TMDB_READ_ACCESS_TOKEN: process.env.TMDB_READ_ACCESS_TOKEN,
		VIDLINK_API_KEY: process.env.VIDLINK_API_KEY,
		VIDSRC_API_KEY: process.env.VIDSRC_API_KEY,
		VIDSRCXYZ_BASE_URL: process.env.VIDSRCXYZ_BASE_URL,
		TWOEMBED_BASE_URL: process.env.TWOEMBED_BASE_URL,
		MAPPLETV_BASE_URL: process.env.MAPPLETV_BASE_URL,
		PRIMEWIRE_BASE_URL: process.env.PRIMEWIRE_BASE_URL,
		MULTIEMBED_BASE_URL: process.env.MULTIEMBED_BASE_URL,
		VIDBINGE_BASE_URL: process.env.VIDBINGE_BASE_URL,
		MOVIESAPI_BASE_URL: process.env.MOVIESAPI_BASE_URL,
		AUTOEMBED_BASE_URL: process.env.AUTOEMBED_BASE_URL,
		CACHE_TTL_MOVIE: process.env.CACHE_TTL_MOVIE,
		CACHE_TTL_SHORT: process.env.CACHE_TTL_SHORT,
		CACHE_TTL_MEDIUM: process.env.CACHE_TTL_MEDIUM,
		CACHE_TTL_LONG: process.env.CACHE_TTL_LONG,
		NODE_ENV: process.env.NODE_ENV,
		PORT: process.env.PORT,
		HOST: process.env.HOST,
		SESSION_SECRET: process.env.SESSION_SECRET,
		COOKIE_SECRET: process.env.COOKIE_SECRET
	};
}
import { z } from 'zod';
import { logger } from './logger';

const envSchema = z.object({
	DATABASE_URL: z.string().url().optional(),
	DATABASE_PATH: z.string().optional(),

	TMDB_API_KEY: z.string().min(1, 'TMDB_API_KEY is required'),
	TMDB_READ_ACCESS_TOKEN: z.string().min(1, 'TMDB_READ_ACCESS_TOKEN is required'),

	VIDLINK_API_KEY: z.string().optional(),
	VIDSRC_API_KEY: z.string().optional(),
	VIDSRCXYZ_BASE_URL: z.string().url().optional(),
	TWOEMBED_BASE_URL: z.string().url().optional(),
	MAPPLETV_BASE_URL: z.string().url().optional(),
	PRIMEWIRE_BASE_URL: z.string().url().optional(),
	MULTIEMBED_BASE_URL: z.string().url().optional(),
	VIDBINGE_BASE_URL: z.string().url().optional(),
	MOVIESAPI_BASE_URL: z.string().url().optional(),
	AUTOEMBED_BASE_URL: z.string().url().optional(),

	CACHE_TTL_MOVIE: z.string().regex(/^\d+$/, 'CACHE_TTL_MOVIE must be a number').optional(),
	CACHE_TTL_SHORT: z.string().regex(/^\d+$/, 'CACHE_TTL_SHORT must be a number').optional(),
	CACHE_TTL_MEDIUM: z.string().regex(/^\d+$/, 'CACHE_TTL_MEDIUM must be a number').optional(),
	CACHE_TTL_LONG: z.string().regex(/^\d+$/, 'CACHE_TTL_LONG must be a number').optional(),

	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	PORT: z.string().regex(/^\d+$/, 'PORT must be a number').default('3000'),
	HOST: z.string().default('0.0.0.0'),

	SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').optional(),
	COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters').optional()
});

export type ValidatedEnv = z.infer<typeof envSchema>;

let validatedEnv: ValidatedEnv | null = null;

export function validateEnvironment(): ValidatedEnv {
	if (process.env.NODE_ENV === 'test' && validatedEnv) {
		validatedEnv = null;
	}

	if (validatedEnv) {
		return validatedEnv;
	}

	try {
		const privateEnv = getPrivateEnv();
		const result = envSchema.safeParse(privateEnv);

		if (!result.success) {
			const errors = result.error.flatten();
			logger.error(
				{
					errors: errors.fieldErrors,
					issues: result.error.issues.map((issue) => ({
						path: issue.path.join('.'),
						message: issue.message
					}))
				},
				'Invalid environment variables'
			);

			if (privateEnv.NODE_ENV !== 'production') {
				logger.warn('Running with invalid environment variables in development mode');
				const fallbackEnv: ValidatedEnv = {
					...privateEnv,
					TMDB_API_KEY: privateEnv.TMDB_API_KEY || 'fallback_api_key',
					TMDB_READ_ACCESS_TOKEN: privateEnv.TMDB_READ_ACCESS_TOKEN || 'fallback_token',
					NODE_ENV: (privateEnv.NODE_ENV as any) || 'development',
					PORT: privateEnv.PORT || '3000',
					HOST: privateEnv.HOST || '0.0.0.0'
				};
				validatedEnv = fallbackEnv;
				return validatedEnv;
			}

			throw new Error(`Invalid environment variables: ${JSON.stringify(errors.fieldErrors)}`);
		}

		validatedEnv = result.data;
		return validatedEnv;
	} catch (error) {
		logger.error({ error }, 'Environment validation failed');
		const privateEnv = getPrivateEnv();
		if (privateEnv.NODE_ENV === 'production') {
			process.exit(1);
		}
		const fallbackEnv: ValidatedEnv = {
			...privateEnv,
			TMDB_API_KEY: privateEnv.TMDB_API_KEY || 'fallback_api_key',
			TMDB_READ_ACCESS_TOKEN: privateEnv.TMDB_READ_ACCESS_TOKEN || 'fallback_token',
			NODE_ENV: (privateEnv.NODE_ENV as any) || 'development',
			PORT: privateEnv.PORT || '3000',
			HOST: privateEnv.HOST || '0.0.0.0'
		};
		validatedEnv = fallbackEnv;
		return validatedEnv;
	}
}

/**
 * Get a validated environment variable with type safety
 * @param key The environment variable key
 * @param defaultValue Optional default value if not set
 * @throws Error if variable is required but not set
 */
export function getEnv<T extends keyof ValidatedEnv>(
	key: T,
	defaultValue?: ValidatedEnv[T]
): ValidatedEnv[T] {
	if (!validatedEnv) {
		validateEnvironment();
	}

	const value = validatedEnv?.[key];

	if (value === undefined) {
		if (defaultValue !== undefined) {
			return defaultValue;
		}
		throw new Error(`Environment variable ${key} is required but not set`);
	}

	return value;
}

/**
 * Validate that all required API keys are set
 * @throws Error if required keys are missing
 */
export function validateApiKeys(): void {
	const env = validateEnvironment();
	const privateEnv = getPrivateEnv();

	if (privateEnv.NODE_ENV === 'production') {
		if (!env.TMDB_API_KEY || env.TMDB_API_KEY === 'fallback_api_key') {
			throw new Error('TMDB_API_KEY is required in production');
		}
		if (!env.TMDB_READ_ACCESS_TOKEN || env.TMDB_READ_ACCESS_TOKEN === 'fallback_token') {
			throw new Error('TMDB_READ_ACCESS_TOKEN is required in production');
		}
	}
}
