import Keyv from 'keyv';
import { KeyvSqlite } from '@keyv/sqlite';
import { LRUCache } from 'lru-cache';
import { logger } from './logger';
import { env } from '$lib/config/env';

export const CACHE_TTL_SHORT_SECONDS = env.CACHE_TTL_SHORT;
export const CACHE_TTL_MEDIUM_SECONDS = env.CACHE_TTL_MEDIUM;
export const CACHE_TTL_LONG_SECONDS = env.CACHE_TTL_LONG;

const store = new KeyvSqlite({ uri: `sqlite://${env.SQLITE_DB_PATH}`, table: 'cache_v2' });

const lruStore = new LRUCache<string, any>({
	max: env.CACHE_MEMORY_MAX_ITEMS,
	ttl: CACHE_TTL_MEDIUM_SECONDS * 1000
});

const cache = new Keyv({
	store,
	namespace: 'meatflicks'
});

cache.on('error', (err) => logger.error({ err }, 'Keyv Connection Error'));

export function buildCacheKey(
	...segments: Array<string | number | boolean | null | undefined>
): string {
	return segments
		.filter((segment) => segment !== undefined && segment !== null && segment !== '')
		.map((segment) =>
			typeof segment === 'string'
				? segment.trim().replace(/\s+/g, '-').toLowerCase()
				: typeof segment === 'boolean'
					? Number(segment).toString()
					: String(segment)
		)
		.join(':');
}

export async function getCachedValue<T>(key: string): Promise<T | undefined> {
	const memHit = lruStore.get(key);
	if (memHit !== undefined) return memHit as T;

	const val = await cache.get(key);
	if (val !== undefined) {
		lruStore.set(key, val);
		return val as T;
	}
	return undefined;
}

export async function setCachedValue<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	const ttlMs = ttlSeconds * 1000;
	lruStore.set(key, value as any, { ttl: ttlMs });
	await cache.set(key, value, ttlMs);
}

export async function deleteCachedValue(key: string): Promise<void> {
	lruStore.delete(key);
	await cache.delete(key);
}

const inflight = new Map<string, Promise<unknown>>();

export async function withCache<T>(
	key: string,
	ttlSeconds: number,
	factory: () => Promise<T>
): Promise<T> {
	const cached = await getCachedValue<T>(key);
	if (cached !== undefined) {
		return cached;
	}

	const pending = inflight.get(key);
	if (pending) {
		return pending as Promise<T>;
	}

	const task = (async () => {
		try {
			const value = await factory();
			if (value !== undefined) {
				await setCachedValue(key, value, ttlSeconds);
			}
			return value;
		} finally {
			inflight.delete(key);
		}
	})();

	inflight.set(key, task);
	return task as Promise<T>;
}

/**
 * Invalidate cache entries matching a pattern
 * @param pattern - Pattern to match (supports wildcards: * for any characters)
 * @returns Number of keys invalidated
 */
export async function invalidateCachePattern(pattern: string): Promise<number> {
	let invalidated = 0;

	try {
		const escapedPattern = pattern
			.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
			.replace(/\*/g, '.*');

		const regex = new RegExp(`^meatflicks:${escapedPattern}$`);

		const lruKeys = Array.from(lruStore.keys());
		for (const key of lruKeys) {
			if (regex.test(key)) {
				lruStore.delete(key);
				invalidated++;
			}
		}

		try {
			const sqliteStore = store as any;
			const db = sqliteStore.db || sqliteStore.client;

			if (db) {
				const sqlPattern = `meatflicks:${pattern.replace(/\*/g, '%')}`;

				let rows: Array<{ key: string }> = [];

				if (typeof db.prepare === 'function') {
					const stmt = db.prepare('SELECT key FROM cache_v2 WHERE key LIKE ?');
					rows = stmt.all(sqlPattern) as Array<{ key: string }>;
				} else if (typeof db.query === 'function') {
					const result = await db.query('SELECT key FROM cache_v2 WHERE key LIKE ?', [sqlPattern]);
					rows = Array.isArray(result) ? result : result.rows || [];
				}

				for (const row of rows) {
					const fullKey = row.key;
					const keyWithoutNamespace = fullKey.replace(/^meatflicks:/, '');

					if (regex.test(fullKey)) {
						await cache.delete(keyWithoutNamespace);
						invalidated++;
					}
				}
			}
		} catch (dbError) {
			logger.warn(
				{ err: dbError, pattern },
				'Failed to query SQLite cache, only cleared LRU cache'
			);
		}

		logger.info({ pattern, invalidated }, 'Cache pattern invalidation completed');
	} catch (error) {
		logger.error({ err: error, pattern }, 'Error invalidating cache pattern');
		throw error;
	}

	return invalidated;
}

/**
 * Invalidate all cache entries with a specific prefix
 * @param prefix - Prefix to match (e.g., 'tmdb:', 'streaming:')
 * @returns Number of keys invalidated
 */
export async function invalidateCachePrefix(prefix: string): Promise<number> {
	return invalidateCachePattern(`${prefix}*`);
}

/**
 * Invalidate cache entries for a specific TMDB ID
 * @param tmdbId - TMDB ID to invalidate
 * @param mediaType - Optional media type filter ('movie' or 'tv')
 * @returns Number of keys invalidated
 */
export async function invalidateTmdbId(
	tmdbId: number,
	mediaType?: 'movie' | 'tv'
): Promise<number> {
	const patterns: string[] = [];

	if (mediaType) {
		patterns.push(`tmdb:${mediaType}:${tmdbId}:*`);
	} else {
		patterns.push(`tmdb:movie:${tmdbId}:*`);
		patterns.push(`tmdb:tv:${tmdbId}:*`);
	}

	let totalInvalidated = 0;
	for (const pattern of patterns) {
		totalInvalidated += await invalidateCachePattern(pattern);
	}

	return totalInvalidated;
}

/**
 * Invalidate cache entries for a specific streaming source
 * @param tmdbId - TMDB ID to invalidate
 * @param mediaType - Media type ('movie' or 'tv')
 * @param season - Optional season number
 * @param episode - Optional episode number
 * @returns Number of keys invalidated
 */
export async function invalidateStreamingSource(
	tmdbId: number,
	mediaType: 'movie' | 'tv',
	season?: number,
	episode?: number
): Promise<number> {
	let pattern = `streaming:${mediaType}:${tmdbId}`;

	if (season !== undefined) {
		pattern += `:${season}`;
		if (episode !== undefined) {
			pattern += `:${episode}`;
		}
		pattern += '*';
	} else {
		pattern += '*';
	}

	return invalidateCachePattern(pattern);
}
