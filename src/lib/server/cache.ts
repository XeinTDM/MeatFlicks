import Keyv from "keyv";
import { KeyvSqlite } from "@keyv/sqlite";
import { LRUCache } from "lru-cache";
import { logger } from './logger';
import { env } from '$lib/config/env';

export const CACHE_TTL_SHORT_SECONDS = env.CACHE_TTL_SHORT;
export const CACHE_TTL_MEDIUM_SECONDS = env.CACHE_TTL_MEDIUM;
export const CACHE_TTL_LONG_SECONDS = env.CACHE_TTL_LONG;

const store = new KeyvSqlite({ uri: `sqlite://${env.SQLITE_DB_PATH}`, table: 'cache_v2' });

const lruStore = new LRUCache<string, any>({
	max: env.CACHE_MEMORY_MAX_ITEMS,
	ttl: CACHE_TTL_MEDIUM_SECONDS * 1000,
});

const cache = new Keyv({
	store,
	namespace: 'meatflicks',
});

cache.on('error', (err) => logger.error({ err }, 'Keyv Connection Error'));

export function buildCacheKey(
	...segments: Array<string | number | boolean | null | undefined>
): string {
	return segments
		.filter((segment) => segment !== undefined && segment !== null && segment !== "")
		.map((segment) =>
			typeof segment === "string"
				? segment.trim().replace(/\s+/g, "-").toLowerCase()
				: typeof segment === "boolean"
					? Number(segment).toString()
					: String(segment)
		)
		.join(":");
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





