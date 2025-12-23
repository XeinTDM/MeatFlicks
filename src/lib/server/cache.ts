import Keyv from 'keyv';
import { KeyvSqlite } from '@keyv/sqlite';
import { LRUCache } from 'lru-cache';
import { logger } from './logger';
import { env } from '$lib/config/env';

// Cache TTL constants
export const CACHE_TTL_SHORT_SECONDS = env.CACHE_TTL_SHORT;
export const CACHE_TTL_MEDIUM_SECONDS = env.CACHE_TTL_MEDIUM;
export const CACHE_TTL_LONG_SECONDS = env.CACHE_TTL_LONG;

// Cache stampede protection constants
const CACHE_STAMPEDE_TIMEOUT_MS = 5000; // 5 seconds
const CACHE_STAMPEDE_MAX_WAITERS = 10; // Maximum concurrent waiters for a cache key

const store = new KeyvSqlite({ uri: `sqlite://${env.SQLITE_DB_PATH}`, table: 'cache_v2' });

const lruStore = new LRUCache<string, any>({
	max: env.CACHE_MEMORY_MAX_ITEMS,
	ttl: CACHE_TTL_MEDIUM_SECONDS * 1000,
	dispose: (value, key, reason) => {
		if (reason === 'expire') {
			cache.delete(key).catch(() => {
				// Silent failure is acceptable
			});
		}
	}
});

const cache = new Keyv({
	store,
	namespace: 'meatflicks'
});

cache.on('error', (err) => logger.error({ err }, 'Keyv Connection Error'));

// Cache stampede protection
interface CacheStampedeEntry {
	promise: Promise<any>;
	timestamp: number;
	waiters: number;
}

const stampedeProtection = new Map<string, CacheStampedeEntry>();

// Enhanced cache cleanup with more frequent LRU cleanup
setInterval(async () => {
	try {
		// More frequent LRU cleanup (every 5 minutes)
		let lruCleaned = 0;
		for (const key of lruStore.keys()) {
			const item = lruStore.peek(key);
			if (item) {
				lruStore.delete(key);
				lruCleaned++;
			}
		}

		// Less frequent SQLite cleanup (every hour)
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
				const result = await db.query('SELECT key FROM cache_v2 WHERE expire IS NOT NULL AND expire < ?', [currentTime]);
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

		logger.debug({
			lruCleaned,
			sqliteCleaned,
			lruSize: lruStore.size,
			activeStampedeEntries: stampedeProtection.size
		}, 'Cache cleanup completed');
	} catch (error) {
		logger.error({ err: error }, 'Cache cleanup failed');
	}
}, 300000); // 5 minutes for more frequent cleanup

// Clean up old stampede protection entries
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
	} = {}
): Promise<T> {
	const {
		stampedeProtection: useStampedeProtection = true,
		cacheOnError = false,
		errorTtlSeconds = 60
	} = options;

	// Check cache first
	const cached = await getCachedValue<T>(key);
	if (cached !== undefined) {
		return cached;
	}

	// Check for existing stampede protection entry
	if (useStampedeProtection) {
		const existingStampede = stampedeProtection.get(key);
		if (existingStampede) {
			// Limit the number of concurrent waiters to prevent memory issues
			if (existingStampede.waiters >= CACHE_STAMPEDE_MAX_WAITERS) {
				logger.warn(
					{ key, waiters: existingStampede.waiters },
					'Cache stampede protection: too many waiters, proceeding without protection'
				);
			} else {
				// Increment waiter count
				existingStampede.waiters++;
				try {
					return await existingStampede.promise;
				} finally {
					existingStampede.waiters--;
				}
			}
		}
	}

	// Check for existing inflight request
	const pending = inflight.get(key);
	if (pending) {
		return pending as Promise<T>;
	}

	// Create new stampede protection entry
	let stampedeEntry: CacheStampedeEntry | undefined;
	if (useStampedeProtection) {
		const promise = (async () => {
			try {
				return await factory();
			} catch (error) {
				if (cacheOnError) {
					await setCachedValue(key, null, errorTtlSeconds);
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
			const value = stampedeEntry
				? await stampedeEntry.promise
				: await factory();

			if (value !== undefined) {
				await setCachedValue(key, value, ttlSeconds);
			} else if (cacheOnError) {
				// Cache null values to prevent repeated failed attempts
				await setCachedValue(key, null, errorTtlSeconds);
			}
			return value;
		} catch (error) {
			if (cacheOnError) {
				logger.warn(
					{ key, error: error instanceof Error ? error.message : String(error) },
					'Caching error response to prevent repeated failures'
				);
				await setCachedValue(key, null, errorTtlSeconds);
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
	staleTtlSeconds: number = ttlSeconds * 2
): Promise<T> {
	const cached = await getCachedValue<T>(key);
	if (cached !== undefined) {
		// Return cached value immediately but refresh in background if stale
		if (staleTtlSeconds > 0) {
			try {
				await getCachedValue<T>(key); // Check if still in cache
				// Refresh in background with lower priority
				setImmediate(() => {
					withCache(key, staleTtlSeconds, factory, { stampedeProtection: true })
						.catch(error => {
							logger.debug(
								{ key, error: error instanceof Error ? error.message : String(error) },
								'Background cache refresh failed'
							);
						});
				});
			} catch {
				// Ignore background refresh errors
			}
		}
		return cached;
	}

	// No cache hit, use regular cache
	return withCache(key, ttlSeconds, factory, { stampedeProtection: true });
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
		}).then(() => {
			// Remove completed promise from active list
			const index = activePromises.indexOf(promise);
			if (index !== -1) {
				activePromises.splice(index, 1);
			}
		}).catch(() => {
			// Remove failed promise from active list
			const index = activePromises.indexOf(promise);
			if (index !== -1) {
				activePromises.splice(index, 1);
			}
		});

		activePromises.push(promise);
	}

	// Wait for all active promises to complete
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
