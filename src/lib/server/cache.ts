import Keyv from "keyv";
import { KeyvSqlite } from "@keyv/sqlite";
import { LRUCache } from "lru-cache";

// Cache settings
const TTL_MIN_SECONDS = 300; // 5 minutes
const TTL_MAX_SECONDS = 1800; // 30 minutes
const DEFAULT_CACHE_MAX_ENTRIES = Number.parseInt(process.env.CACHE_MEMORY_MAX_ITEMS ?? "", 10) || 512;

const clampTtl = (value: number, fallback: number): number => {
	if (!Number.isFinite(value)) {
		return fallback;
	}
	return Math.min(Math.max(value, TTL_MIN_SECONDS), TTL_MAX_SECONDS);
};

const parseTtl = (envVar: string, fallback: number): number => {
	const raw = process.env[envVar];
	if (!raw) {
		return fallback;
	}

	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return clampTtl(parsed, fallback);
};

export const CACHE_TTL_SHORT_SECONDS = parseTtl("CACHE_TTL_SHORT", 300);
export const CACHE_TTL_MEDIUM_SECONDS = parseTtl("CACHE_TTL_MEDIUM", 900);
export const CACHE_TTL_LONG_SECONDS = parseTtl("CACHE_TTL_LONG", 1500);

// Initialize Keyv with tiered storage
// Note: We use the same SQLite file for consistency
const dbPath = process.env.SQLITE_DB_PATH || 'data/meatflicks.db';
const store = new KeyvSqlite({ uri: `sqlite://${dbPath}`, table: 'cache_v2' });

const lruStore = new LRUCache<string, any>({
	max: DEFAULT_CACHE_MAX_ENTRIES,
	ttl: CACHE_TTL_MEDIUM_SECONDS * 1000,
});

const cache = new Keyv({
	store,
	namespace: 'meatflicks',
});

// In-memory level 1 cache
cache.on('error', (err) => console.error('Keyv Connection Error', err));

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
	// Level 1: LRU Memory Hit
	const memHit = lruStore.get(key);
	if (memHit !== undefined) return memHit as T;

	// Level 2: Persistent Keyv Hit
	const val = await cache.get(key);
	if (val !== undefined) {
		lruStore.set(key, val); // Backfill L1
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

// Optimized withCache with request deduplication
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

	// Request deduplication (Inflight merging)
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

// Backward compatibility for createTtlCache used in services
export interface TtlCacheOptions {
	ttlMs: number;
	maxEntries?: number;
}

export function createTtlCache<K, V>(options: TtlCacheOptions) {
	const localLru = new LRUCache<string, any>({
		max: options.maxEntries || 500,
		ttl: options.ttlMs
	});

	const inflight = new Map<string, Promise<V>>();

	return {
		get: (key: K) => localLru.get(String(key)) ?? null,
		set: (key: K, value: V, setOptions?: { ttlMs?: number }) => {
			const ttl = setOptions?.ttlMs ?? options.ttlMs;
			localLru.set(String(key), value as any, { ttl });
		},
		getOrSet: async (key: K, loader: () => Promise<V>, setOptions?: { ttlMs?: number }): Promise<V> => {
			const sKey = String(key);
			const cached = localLru.get(sKey);
			if (cached !== undefined) return cached;

			const pending = inflight.get(sKey);
			if (pending) return pending;

			const task = (async () => {
				try {
					const val = await loader();
					const ttl = setOptions?.ttlMs ?? options.ttlMs;
					localLru.set(sKey, val as any, { ttl });
					return val;
				} finally {
					inflight.delete(sKey);
				}
			})();

			inflight.set(sKey, task);
			return task;
		},
		clear: () => localLru.clear(),
		delete: (key: K) => localLru.delete(String(key)),
		size: () => localLru.size
	};
}



