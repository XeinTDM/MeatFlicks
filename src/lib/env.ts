import { z } from 'zod';

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  GITHUB_ID: z.string().min(1),
  GITHUB_SECRET: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  TMDB_API_KEY: z.string().min(1),
  TMDB_IMAGE_BASE_URL: z.string().url(),
  TMDB_POSTER_SIZE: z.string().min(1),
  TMDB_BACKDROP_SIZE: z.string().min(1),
});

const clientSchema = z.object({
  NEXT_PUBLIC_BASE_URL: z.string().url(),
  NEXT_PUBLIC_TMDB_API_KEY: z.string().min(1),
  NEXT_PUBLIC_TMDB_IMAGE_BASE_URL: z.string().url(),
  NEXT_PUBLIC_TMDB_POSTER_SIZE: z.string().min(1),
  NEXT_PUBLIC_TMDB_BACKDROP_SIZE: z.string().min(1),
});

const processEnv = {
  ...process.env,
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_TMDB_API_KEY: process.env.NEXT_PUBLIC_TMDB_API_KEY || process.env.TMDB_API_KEY,
  NEXT_PUBLIC_TMDB_IMAGE_BASE_URL: process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE_URL || process.env.TMDB_IMAGE_BASE_URL,
  NEXT_PUBLIC_TMDB_POSTER_SIZE: process.env.NEXT_PUBLIC_TMDB_POSTER_SIZE || process.env.TMDB_POSTER_SIZE,
  NEXT_PUBLIC_TMDB_BACKDROP_SIZE: process.env.NEXT_PUBLIC_TMDB_BACKDROP_SIZE || process.env.TMDB_BACKDROP_SIZE,
};

const _clientEnv = clientSchema.safeParse(processEnv);

if (!_clientEnv.success) {
  console.error(
    "❌ Invalid client environment variables:",
    _clientEnv.error.flatten().fieldErrors
  );
  throw new Error("Invalid client environment variables");
}

const _serverEnv = serverSchema.safeParse(processEnv);

if (!_serverEnv.success) {
  console.error(
    "❌ Invalid server environment variables:",
    _serverEnv.error.flatten().fieldErrors
  );
  throw new Error("Invalid server environment variables");
}

export const env = { ..._serverEnv.data, ..._clientEnv.data };