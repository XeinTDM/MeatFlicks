import Keyv from 'keyv';
import { KeyvSqlite } from '@keyv/sqlite';
import { LRUCache } from 'lru-cache';
import { z, type ZodType } from 'zod';
import { logger } from './logger';
import { env } from '../config/env';

export const CACHE_TTL_SHORT_SECONDS = env.CACHE_TTL_SHORT;
export const CACHE_TTL_MEDIUM_SECONDS = env.CACHE_TTL_MEDIUM;
export const CACHE_TTL_LONG_SECONDS = env.CACHE_TTL_LONG;
export const CACHE_TTL_SEARCH_SECONDS = 900;

const CACHE_STAMPEDE_TIMEOUT_MS = 5000;
const CACHE_STAMPEDE_MAX_WAITERS = 10;

const store = new KeyvSqlite({ uri: `sqlite://${env.SQLITE_DB_PATH}`, table: 'cache_v2' });

const lruStore = new LRUCache<string, any>({
	max: env.CACHE_MEMORY_MAX_ITEMS,
	ttl: CACHE_TTL_MEDIUM_SECONDS * 1000,
	dispose: (value, key, reason) => {
		if (reason === 'expire') {
			cache.delete(key).catch(() => {
				// Silent
			});
		}
	}
});

const cache = new Keyv({
	store,
	namespace: 'meatflicks'
});

cache.on('error', (err) => logger.error({ err }, 'Keyv Connection Error'));

interface CacheStampedeEntry {
	promise: Promise<any>;
	timestamp: number;
	waiters: number;
}

const stampedeProtection = new Map<string, CacheStampedeEntry>();

setInterval(async () => {
	try {
		let lruCleaned = 0;
		for (const key of lruStore.keys()) {
			const item = lruStore.peek(key);
			if (item) {
				lruStore.delete(key);
				lruCleaned++;
			}
		}

		let sqliteCleaned = 0;
		try {
			const sqliteStore = store as any;
			const db = sqliteStore.db || sqliteStore.client;

			if (db && typeof db.prepare === 'function') {
				const currentTime = Date.now();
				const stmt = db.prepare('SELECT key FROM cache_v2 WHERE expire IS NOT NULL AND expire < ?');
				const expiredKeys = stmt.all(currentTime) as Array<{ key: string }>;

				for (const { key } of expiredKeys) {
					try {
						await cache.delete(key);
						sqliteCleaned++;
					} catch (deleteError) {
						logger.warn({ err: deleteError, key }, 'Failed to delete expired cache entry');
					}
				}
			} else if (db && typeof db.query === 'function') {
				const currentTime = Date.now();
				const result = await db.query(
					'SELECT key FROM cache_v2 WHERE expire IS NOT NULL AND expire < ?',
					[currentTime]
				);
				const expiredKeys = Array.isArray(result) ? result : result.rows || [];

				for (const row of expiredKeys) {
					try {
						await cache.delete(row.key);
						sqliteCleaned++;
					} catch (deleteError) {
						logger.warn({ err: deleteError, key: row.key }, 'Failed to delete expired cache entry');
					}
				}
			}
		} catch (dbError) {
			logger.warn({ err: dbError }, 'Failed to clean up SQLite cache');
		}

		logger.debug(
			{
				lruCleaned,
				sqliteCleaned,
				lruSize: lruStore.size,
				activeStampedeEntries: stampedeProtection.size
			},
			'Cache cleanup completed'
		);
	} catch (error) {
		logger.error({ err: error }, 'Cache cleanup failed');
	}
}, 300000);

setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of stampedeProtection) {
		if (now - entry.timestamp > CACHE_STAMPEDE_TIMEOUT_MS) {
			stampedeProtection.delete(key);
		}
	}
}, 10000);

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

interface CacheEntry<T> {
	v: T;
	t: number;
}

function isCacheEntry<T>(val: any): val is CacheEntry<T> {
	return val && typeof val === 'object' && 'v' in val && 't' in val;
}

export async function getCachedValue<T>(key: string, schema?: ZodType<T>): Promise<T | undefined> {
	const entry = await getCacheEntry<T>(key, schema);
	return entry?.v;
}

async function getCacheEntry<T>(
	key: string,
	schema?: ZodType<T>
): Promise<CacheEntry<T> | undefined> {
	const memHit = lruStore.get(key);
	if (memHit !== undefined) {
		if (isCacheEntry<T>(memHit)) {
			if (schema) {
				const validation = schema.safeParse(memHit.v);
				if (!validation.success) {
					logger.warn({ key, err: validation.error }, 'Cache validation failed (LRU)');
					lruStore.delete(key);
					return undefined;
				}
			}
			return memHit;
		}

		const val = memHit as T;
		if (schema) {
			const validation = schema.safeParse(val);
			if (!validation.success) {
				logger.warn({ key, err: validation.error }, 'Cache validation failed (LRU raw)');
				lruStore.delete(key);
				return undefined;
			}
		}

		return { v: val, t: Date.now() };
	}

	const val = await cache.get(key);
	if (val !== undefined) {
		const entry: CacheEntry<T> = isCacheEntry<T>(val) ? val : { v: val as T, t: Date.now() };

		if (schema) {
			const validation = schema.safeParse(entry.v);
			if (!validation.success) {
				logger.warn({ key, err: validation.error }, 'Cache validation failed (DB)');
				await cache.delete(key);
				return undefined;
			}
		}

		lruStore.set(key, entry);
		return entry;
	}
	return undefined;
}

export async function setCachedValue<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	const ttlMs = ttlSeconds * 1000;
	const entry: CacheEntry<T> = { v: value, t: Date.now() };
	lruStore.set(key, entry, { ttl: ttlMs });
	await cache.set(key, entry, ttlMs);
}

export async function deleteCachedValue(key: string): Promise<void> {
	lruStore.delete(key);
	await cache.delete(key);
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * Enhanced cache wrapper with stampede protection and improved error handling
 */
export async function withCache<T>(
	key: string,
	ttlSeconds: number,
	factory: () => Promise<T>,
	options: {
		stampedeProtection?: boolean;
		cacheOnError?: boolean;
		errorTtlSeconds?: number;
		swrSeconds?: number;
		schema?: ZodType<T>;
	} = {}
): Promise<T> {
	const {
		stampedeProtection: useStampedeProtection = true,
		cacheOnError = false,
		errorTtlSeconds = 60,
		swrSeconds,
		schema
	} = options;

	const entry = await getCacheEntry<T>(key, schema);

	if (entry !== undefined) {
		if (swrSeconds !== undefined && Date.now() - entry.t > swrSeconds * 1000) {
			const pendingRefresh = inflight.get(key);
			if (!pendingRefresh) {
				const refreshTask = (async () => {
					try {
						logger.debug({ key }, '[cache] SWR background refresh started');
						const newValue = await factory();
						await setCachedValue(key, newValue, ttlSeconds);
					} catch (error) {
						logger.debug({ key, error }, '[cache] SWR background refresh failed');
					} finally {
						inflight.delete(key);
					}
				})();
				inflight.set(key, refreshTask);
			}
		}
		return entry.v;
	}

	if (useStampedeProtection) {
		const existingStampede = stampedeProtection.get(key);
		if (existingStampede) {
			if (existingStampede.waiters >= CACHE_STAMPEDE_MAX_WAITERS) {
				logger.warn(
					{ key, waiters: existingStampede.waiters },
					'Cache stampede protection: too many waiters, proceeding without protection'
				);
			} else {
				existingStampede.waiters++;
				try {
					return await existingStampede.promise;
				} finally {
					existingStampede.waiters--;
				}
			}
		}
	}

	const pending = inflight.get(key);
	if (pending) {
		return pending as Promise<T>;
	}

	let stampedeEntry: CacheStampedeEntry | undefined;
	if (useStampedeProtection) {
		const promise = (async () => {
			try {
				return await factory();
			} catch (error) {
				if (cacheOnError) {
					await setCachedValue(key, null as T, errorTtlSeconds);
				}
				throw error;
			}
		})();

		stampedeEntry = {
			promise,
			timestamp: Date.now(),
			waiters: 1
		};
		stampedeProtection.set(key, stampedeEntry);
	}

	const task = (async () => {
		try {
			const value = stampedeEntry ? await stampedeEntry.promise : await factory();

			if (value !== undefined) {
				await setCachedValue(key, value, ttlSeconds);
			} else if (cacheOnError) {
				await setCachedValue(key, null as T, errorTtlSeconds);
			}
			return value;
		} catch (error) {
			if (cacheOnError) {
				logger.warn(
					{ key, error: error instanceof Error ? error.message : String(error) },
					'Caching error response to prevent repeated failures'
				);
				await setCachedValue(key, null as T, errorTtlSeconds);
			}
			throw error;
		} finally {
			inflight.delete(key);
			if (stampedeEntry) {
				stampedeProtection.delete(key);
			}
		}
	})();

	inflight.set(key, task);
	return task as Promise<T>;
}

/**
 * Enhanced cache wrapper with automatic refresh for stale data
 */
export async function withCacheRefresh<T>(
	key: string,
	ttlSeconds: number,
	factory: () => Promise<T>,
	swrSeconds: number = Math.floor(ttlSeconds / 2),
	schema?: ZodType<T>
): Promise<T> {
	return withCache(key, ttlSeconds, factory, { swrSeconds, stampedeProtection: true, schema });
}

/**
 * Cache warming function to pre-populate cache for expected requests
 */
export async function warmCache<T>(
	keys: string[],
	ttlSeconds: number,
	factory: (key: string) => Promise<T>,
	concurrency: number = 3
): Promise<void> {
	const queue = [...keys];
	const activePromises: Promise<void>[] = [];

	while (queue.length > 0 && activePromises.length < concurrency) {
		const key = queue.shift()!;
		const promise = withCache(key, ttlSeconds, () => factory(key), {
			stampedeProtection: false,
			cacheOnError: true
		})
			.then(() => {
				const index = activePromises.indexOf(promise);
				if (index !== -1) {
					activePromises.splice(index, 1);
				}
			})
			.catch(() => {
				const index = activePromises.indexOf(promise);
				if (index !== -1) {
					activePromises.splice(index, 1);
				}
			});

		activePromises.push(promise);
	}

	await Promise.all(activePromises);
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): {
	lruSize: number;
	lruMax: number;
	stampedeEntries: number;
} {
	return {
		lruSize: lruStore.size,
		lruMax: lruStore.max,
		stampedeEntries: stampedeProtection.size
	};
}

/**
 * Cache key generator with versioning support
 */
export function buildVersionedCacheKey(
	version: string,
	...segments: Array<string | number | boolean | null | undefined>
): string {
	return buildCacheKey('v' + version, ...segments);
}

/**
 * Invalidate cache entries matching a pattern
 * @param pattern - Pattern to match (supports wildcards: * for any characters)
 * @returns Number of keys invalidated
 */
export async function invalidateCachePattern(pattern: string): Promise<number> {
	let invalidated = 0;

	try {
		const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');

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
	mediaType?: 'movie' | 'tv' | 'anime'
): Promise<number> {
	const patterns: string[] = [];

	if (mediaType) {
		patterns.push(`tmdb:${mediaType}:${tmdbId}:*`);
	} else {
		patterns.push(`tmdb:movie:${tmdbId}:*`);
		patterns.push(`tmdb:tv:${tmdbId}:*`);
		patterns.push(`tmdb:anime:${tmdbId}:*`);
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
	mediaType: 'movie' | 'tv' | 'anime',
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
