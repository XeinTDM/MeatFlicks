export interface TtlCacheOptions {
  ttlMs: number;
  maxEntries?: number;
  clock?: () => number;
}

export interface TtlCacheSetOptions {
  ttlMs?: number;
}

export interface TtlCache<K, V> {
  get(key: K): V | null;
  set(key: K, value: V, options?: TtlCacheSetOptions): void;
  getOrSet(key: K, loader: () => Promise<V>, options?: TtlCacheSetOptions): Promise<V>;
  delete(key: K): void;
  clear(): void;
  size(): number;
}

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export function createTtlCache<K, V>(options: TtlCacheOptions): TtlCache<K, V> {
  const store = new Map<K, CacheEntry<V>>();
  const inflight = new Map<K, Promise<V>>();
  const clock = options.clock ?? (() => Date.now());
  const baseTtl = Math.max(0, options.ttlMs);
  const maxEntries = options.maxEntries && options.maxEntries > 0 ? options.maxEntries : null;

  const pruneExpired = (now = clock()) => {
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }
  };

  const evictOverflow = () => {
    if (!maxEntries) return;
    if (store.size <= maxEntries) return;
    const overflow = store.size - maxEntries;
    for (let i = 0; i < overflow; i += 1) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  };

  const get = (key: K): V | null => {
    pruneExpired();

    const entry = store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= clock()) {
      store.delete(key);
      return null;
    }

    if (maxEntries) {
      store.delete(key);
      store.set(key, entry);
    }

    return entry.value;
  };

  const set = (key: K, value: V, setOptions?: TtlCacheSetOptions) => {
    pruneExpired();

    const ttlOverride = setOptions?.ttlMs;
    const ttl = ttlOverride !== undefined ? Math.max(0, ttlOverride) : baseTtl;

    if (ttl === 0) {
      store.delete(key);
      return;
    }

    const expiresAt = clock() + ttl;
    store.set(key, { value, expiresAt });
    evictOverflow();
  };

  const getOrSet = async (key: K, loader: () => Promise<V>, setOptions?: TtlCacheSetOptions): Promise<V> => {
    const cached = get(key);
    if (cached !== null) {
      return cached;
    }

    const pending = inflight.get(key);
    if (pending) {
      return pending;
    }

    const task = (async () => {
      try {
        const value = await loader();
        set(key, value, setOptions);
        return value;
      } finally {
        inflight.delete(key);
      }
    })();

    inflight.set(key, task);
    return task;
  };

  const remove = (key: K) => {
    store.delete(key);
  };

  const clear = () => {
    store.clear();
    inflight.clear();
  };

  const size = () => store.size;

  return {
    get,
    set,
    getOrSet,
    delete: remove,
    clear,
    size
  };
}
