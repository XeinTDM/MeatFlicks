import { env as privateEnv } from '$env/dynamic/private';
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
	EMBEDSU_BASE_URL: z.string().url().optional(),
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
	if (validatedEnv) {
		return validatedEnv;
	}

	try {
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
				validatedEnv = privateEnv as unknown as ValidatedEnv;
				return validatedEnv;
			}

			throw new Error(`Invalid environment variables: ${JSON.stringify(errors.fieldErrors)}`);
		}

		validatedEnv = result.data;
		return validatedEnv;
	} catch (error) {
		logger.error({ error }, 'Environment validation failed');
		if (privateEnv.NODE_ENV === 'production') {
			process.exit(1);
		}
		validatedEnv = privateEnv as unknown as ValidatedEnv;
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

	if (privateEnv.NODE_ENV === 'production') {
		if (!env.TMDB_API_KEY) {
			throw new Error('TMDB_API_KEY is required in production');
		}
		if (!env.TMDB_READ_ACCESS_TOKEN) {
			throw new Error('TMDB_READ_ACCESS_TOKEN is required in production');
		}
	}
}
