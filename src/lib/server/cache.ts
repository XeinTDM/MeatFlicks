import { LRUCache } from "lru-cache";
import sqlite from "$lib/server/db";
export { createTtlCache } from "./cache/ttl-cache";

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

const deepClone = <T>(value: T): T => {
	if (value === null || typeof value !== "object") {
		return value;
	}

	if (typeof structuredClone === "function") {
		return structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value)) as T;
};

type MemoryEnvelope<T> = { value: T };

type GlobalWithCache = typeof globalThis & {
	__meatflicksMemoryCache?: LRUCache<string, MemoryEnvelope<unknown>>;
	__meatflicksPersistentCacheDisabled?: boolean;
};

const globalRef = globalThis as GlobalWithCache;

const memoryCache = (() => {
	if (globalRef.__meatflicksMemoryCache) {
		return globalRef.__meatflicksMemoryCache;
	}

	const cache = new LRUCache<string, MemoryEnvelope<unknown>>({
		max: DEFAULT_CACHE_MAX_ENTRIES,
		ttl: CACHE_TTL_MEDIUM_SECONDS * 1000,
		allowStale: false
	});

	globalRef.__meatflicksMemoryCache = cache;
	return cache;
})();

let persistentCacheDisabled = Boolean(globalRef.__meatflicksPersistentCacheDisabled);

const selectCacheStatement = sqlite.prepare("SELECT data, expiresAt FROM cache WHERE key = ?");
const deleteCacheStatement = sqlite.prepare("DELETE FROM cache WHERE key = ?");
const upsertCacheStatement = sqlite.prepare(
	"INSERT INTO cache (key, data, expiresAt) VALUES (@key, @data, @expiresAt) " +
		"ON CONFLICT(key) DO UPDATE SET data = excluded.data, expiresAt = excluded.expiresAt"
);
const purgeExpiredStatement = sqlite.prepare("DELETE FROM cache WHERE expiresAt <= ?");

const markPersistentCacheDisabled = (error: unknown) => {
	if (persistentCacheDisabled) {
		return;
	}
	persistentCacheDisabled = true;
	globalRef.__meatflicksPersistentCacheDisabled = true;
	console.warn("[cache] Disabling persistent SQLite-backed cache after repeated errors.", error);
};

const setMemoryValue = <T>(key: string, value: T, ttlSeconds: number) => {
	if (ttlSeconds <= 0) {
		memoryCache.delete(key);
		return;
	}

	memoryCache.set(key, { value: deepClone(value) }, { ttl: ttlSeconds * 1000 });
};

const getMemoryValue = <T>(key: string): T | undefined => {
	const envelope = memoryCache.get(key);
	if (!envelope) {
		return undefined;
	}
	return deepClone(envelope.value) as T;
};

const deleteMemoryValue = (key: string) => {
	memoryCache.delete(key);
};

const readPersistentValue = <T>(key: string): T | undefined => {
	if (persistentCacheDisabled) {
		return undefined;
	}

	try {
		const record = selectCacheStatement.get(key) as { data: string; expiresAt: number } | undefined;
		if (!record) {
			return undefined;
		}

		const expiresInMs = record.expiresAt - Date.now();
		if (expiresInMs <= 0) {
			deleteCacheStatement.run(key);
			return undefined;
		}

		try {
			const parsed = JSON.parse(record.data) as T;
			const ttlSeconds = Math.max(1, Math.floor(expiresInMs / 1000));
			setMemoryValue(key, parsed, ttlSeconds);
			return deepClone(parsed);
		} catch (error) {
			console.warn(`[cache] Failed to parse cached payload for key ${key}.`, error);
			deleteCacheStatement.run(key);
			return undefined;
		}
	} catch (error) {
		markPersistentCacheDisabled(error);
		return undefined;
	}
};

const writePersistentValue = <T>(key: string, value: T, ttlSeconds: number) => {
	if (persistentCacheDisabled) {
		return;
	}

	try {
		if (ttlSeconds <= 0) {
			deleteCacheStatement.run(key);
			return;
		}

		const expiresAt = Date.now() + ttlSeconds * 1000;
		const payload = JSON.stringify(deepClone(value));
		upsertCacheStatement.run({ key, data: payload, expiresAt });
	} catch (error) {
		markPersistentCacheDisabled(error);
	}
};

const deletePersistentValue = (key: string) => {
	if (persistentCacheDisabled) {
		return;
	}

	try {
		deleteCacheStatement.run(key);
	} catch (error) {
		markPersistentCacheDisabled(error);
	}
};

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
	const memoryHit = getMemoryValue<T>(key);
	if (memoryHit !== undefined) {
		return memoryHit;
	}

	return readPersistentValue<T>(key);
}

export async function setCachedValue<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	setMemoryValue(key, value, ttlSeconds);
	writePersistentValue(key, value, ttlSeconds);

	try {
		purgeExpiredStatement.run(Date.now());
	} catch (error) {
		console.warn("[cache] Failed to purge expired entries", error);
	}
}

export async function deleteCachedValue(key: string): Promise<void> {
	deleteMemoryValue(key);
	deletePersistentValue(key);
}

export async function withCache<T>(
	key: string,
	ttlSeconds: number,
	factory: () => Promise<T>
): Promise<T> {
	const cached = await getCachedValue<T>(key);
	if (cached !== undefined) {
		return cached;
	}

	const value = await factory();
	if (typeof value === "undefined") {
		return value;
	}

	await setCachedValue(key, value, ttlSeconds);
	return value;
}
