import { describe, expect, it } from 'vitest';
import { createTtlCache } from '$lib/server/cache';

describe('createTtlCache', () => {
  it('returns cached value before ttl expires', async () => {
    let now = 0;
    const cache = createTtlCache<string, number>({ ttlMs: 1000, clock: () => now });

    const value = await cache.getOrSet('alpha', async () => 42);
    expect(value).toBe(42);

    now = 500;
    expect(cache.get('alpha')).toBe(42);
  });

  it('evicts expired entries when ttl elapses', async () => {
    let now = 0;
    const cache = createTtlCache<string, number>({ ttlMs: 1000, clock: () => now });

    await cache.getOrSet('beta', async () => 7);
    now = 1500;
    expect(cache.get('beta')).toBeNull();
  });

  it('deduplicates concurrent loaders', async () => {
    let calls = 0;
    const cache = createTtlCache<string, number>({ ttlMs: 1000 });

    const loader = async () => {
      calls += 1;
      return 99;
    };

    const [first, second] = await Promise.all([
      cache.getOrSet('gamma', loader),
      cache.getOrSet('gamma', loader)
    ]);

    expect(first).toBe(99);
    expect(second).toBe(99);
    expect(calls).toBe(1);
  });
});
