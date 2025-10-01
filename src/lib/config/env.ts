import { env as privateEnv } from '$env/dynamic/private';
import { z } from 'zod';

const serverSchema = z.object({
	TMDB_API_KEY: z.string().min(1, 'TMDB_API_KEY is required to fetch TMDB metadata.'),
	TMDB_IMAGE_BASE_URL: z.string().url().default('https://image.tmdb.org/t/p/'),
	TMDB_POSTER_SIZE: z.string().min(1).default('w500'),
	TMDB_BACKDROP_SIZE: z.string().min(1).default('original')
});

const serverResult = serverSchema.safeParse({
	TMDB_API_KEY: privateEnv.TMDB_API_KEY,
	TMDB_IMAGE_BASE_URL: privateEnv.TMDB_IMAGE_BASE_URL,
	TMDB_POSTER_SIZE: privateEnv.TMDB_POSTER_SIZE,
	TMDB_BACKDROP_SIZE: privateEnv.TMDB_BACKDROP_SIZE
});

if (!serverResult.success) {
	console.error('Invalid server environment variables:', serverResult.error.flatten().fieldErrors);
	throw new Error('Invalid server environment variables');
}

const serverEnv = serverResult.data;

const clientSchema = z.object({
	NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
	NEXT_PUBLIC_TMDB_API_KEY: z.string().min(1).optional(),
	NEXT_PUBLIC_TMDB_IMAGE_BASE_URL: z.string().url().optional(),
	NEXT_PUBLIC_TMDB_POSTER_SIZE: z.string().min(1).optional(),
	NEXT_PUBLIC_TMDB_BACKDROP_SIZE: z.string().min(1).optional()
});

const clientResult = clientSchema.safeParse({
	NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
	NEXT_PUBLIC_TMDB_API_KEY: process.env.NEXT_PUBLIC_TMDB_API_KEY ?? serverEnv.TMDB_API_KEY,
	NEXT_PUBLIC_TMDB_IMAGE_BASE_URL:
		process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE_URL ?? serverEnv.TMDB_IMAGE_BASE_URL,
	NEXT_PUBLIC_TMDB_POSTER_SIZE:
		process.env.NEXT_PUBLIC_TMDB_POSTER_SIZE ?? serverEnv.TMDB_POSTER_SIZE,
	NEXT_PUBLIC_TMDB_BACKDROP_SIZE:
		process.env.NEXT_PUBLIC_TMDB_BACKDROP_SIZE ?? serverEnv.TMDB_BACKDROP_SIZE
});

if (!clientResult.success) {
	console.error('Invalid client environment variables:', clientResult.error.flatten().fieldErrors);
	throw new Error('Invalid client environment variables');
}

export const env = {
	...serverEnv,
	...clientResult.data
};
