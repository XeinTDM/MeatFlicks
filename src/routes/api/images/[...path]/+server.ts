import { type RequestHandler } from '@sveltejs/kit';
import { env } from '$lib/config/env';
import { getCachedValue, setCachedValue, buildCacheKey } from '$lib/server/cache';
import { logger } from '$lib/server/logger';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';
const ALLOWED_SIZES = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'];

export const GET: RequestHandler = async ({ params, url }) => {
	const path = params.path;
	if (!path) {
		return new Response('Path is required', { status: 400 });
	}

	const width = url.searchParams.get('w') || 'original';
	const size = ALLOWED_SIZES.includes(width) ? width : width.startsWith('w') ? width : `w${width}`;

	// Normalize path (SvelteKit might pass it with or without leading slash depending on how it's called)
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	const tmdbUrl = `${TMDB_IMAGE_BASE}${size}${normalizedPath}`;
	const cacheKey = buildCacheKey('image-proxy', size, normalizedPath);

	try {
		const cached = await getCachedValue<{ contentType: string; data: string }>(cacheKey);

		if (cached) {
			const buffer = Buffer.from(cached.data, 'base64');
			return new Response(buffer, {
				headers: {
					'Content-Type': cached.contentType,
					'Cache-Control': 'public, max-age=2592000, immutable',
					'X-Cache': 'HIT'
				}
			});
		}

		logger.debug({ tmdbUrl }, '[image-proxy] Fetching from TMDB');
		const response = await fetch(tmdbUrl, {
			headers: {
				Authorization: `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`
			}
		});

		if (!response.ok) {
			logger.warn({ tmdbUrl, status: response.status }, '[image-proxy] TMDB fetch failed');
			return new Response('Failed to fetch image from TMDB', { status: response.status });
		}

		const contentType = response.headers.get('Content-Type') || 'image/jpeg';
		const blob = await response.arrayBuffer();
		const buffer = Buffer.from(blob);
		const base64 = buffer.toString('base64');

		await setCachedValue(cacheKey, { contentType, data: base64 }, 2592000);

		return new Response(buffer, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=2592000, immutable',
				'X-Cache': 'MISS'
			}
		});
	} catch (error) {
		logger.error({ error, path }, '[image-proxy] Failed to proxy image');
		return new Response('Internal Server Error', { status: 500 });
	}
};
