import { env as privateEnv } from '$env/dynamic/private';
import { z } from 'zod';

const serverSchema = z.object({
	TMDB_API_KEY: z.string().min(1, 'TMDB_API_KEY is required'),
	TMDB_IMAGE_BASE_URL: z.string().url().default('https://image.tmdb.org/t/p/'),
	TMDB_POSTER_SIZE: z.string().min(1).default('w500'),
	TMDB_BACKDROP_SIZE: z.string().min(1).default('original'),
	SQLITE_DB_PATH: z.string().default('data/meatflicks.db'),
	LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
	CACHE_TTL_SHORT: z.coerce.number().min(60).default(300),
	CACHE_TTL_MEDIUM: z.coerce.number().min(300).default(900),
	CACHE_TTL_LONG: z.coerce.number().min(900).default(1800),
	CACHE_MEMORY_MAX_ITEMS: z.coerce.number().min(1).default(512),
	TMDB_STILL_SIZE: z.string().min(1).default('w300')
});

const serverResult = serverSchema.safeParse({
	TMDB_API_KEY: privateEnv.TMDB_API_KEY,
	TMDB_IMAGE_BASE_URL: privateEnv.TMDB_IMAGE_BASE_URL,
	TMDB_POSTER_SIZE: privateEnv.TMDB_POSTER_SIZE,
	TMDB_BACKDROP_SIZE: privateEnv.TMDB_BACKDROP_SIZE,
	SQLITE_DB_PATH: privateEnv.SQLITE_DB_PATH,
	LOG_LEVEL: privateEnv.LOG_LEVEL,
	CACHE_TTL_SHORT: privateEnv.CACHE_TTL_SHORT,
	CACHE_TTL_MEDIUM: privateEnv.CACHE_TTL_MEDIUM,
	CACHE_TTL_LONG: privateEnv.CACHE_TTL_LONG,
	CACHE_MEMORY_MAX_ITEMS: privateEnv.CACHE_MEMORY_MAX_ITEMS,
	TMDB_STILL_SIZE: privateEnv.TMDB_STILL_SIZE
});

if (!serverResult.success) {
	console.error('Invalid server environment variables:', serverResult.error.flatten().fieldErrors);
	throw new Error('Invalid server environment variables');
}

const serverEnv = serverResult.data;

const clientSchema = z.object({
	PUBLIC_BASE_URL: z.string().url().optional(),
	PUBLIC_TMDB_API_KEY: z.string().min(1).optional(),
	PUBLIC_TMDB_IMAGE_BASE_URL: z.string().url().optional(),
	PUBLIC_TMDB_POSTER_SIZE: z.string().min(1).optional(),
	PUBLIC_TMDB_BACKDROP_SIZE: z.string().min(1).optional()
});

const clientResult = clientSchema.safeParse({
	PUBLIC_BASE_URL: privateEnv.PUBLIC_BASE_URL,
	PUBLIC_TMDB_API_KEY: privateEnv.PUBLIC_TMDB_API_KEY ?? serverEnv.TMDB_API_KEY,
	PUBLIC_TMDB_IMAGE_BASE_URL:
		privateEnv.PUBLIC_TMDB_IMAGE_BASE_URL ?? serverEnv.TMDB_IMAGE_BASE_URL,
	PUBLIC_TMDB_POSTER_SIZE:
		privateEnv.PUBLIC_TMDB_POSTER_SIZE ?? serverEnv.TMDB_POSTER_SIZE,
	PUBLIC_TMDB_BACKDROP_SIZE:
		privateEnv.PUBLIC_TMDB_BACKDROP_SIZE ?? serverEnv.TMDB_BACKDROP_SIZE
});

if (!clientResult.success) {
	console.error('Invalid client environment variables:', clientResult.error.flatten().fieldErrors);
	throw new Error('Invalid client environment variables');
}

export const env = {
	...serverEnv,
	...clientResult.data
};

