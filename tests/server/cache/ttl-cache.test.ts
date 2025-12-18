import { describe, expect, it } from 'vitest';
import { createTtlCache } from '$lib/server/cache';

describe('createTtlCache', () => {
	it('returns cached value before ttl expires', async () => {
		const cache = createTtlCache<string, number>({ ttlMs: 1000 });

		const value = await cache.getOrSet('alpha', async () => 42);
		expect(value).toBe(42);

		expect(cache.get('alpha')).toBe(42);
	});

	it('deduplicates concurrent loaders', async () => {
		let calls = 0;
		const cache = createTtlCache<string, number>({ ttlMs: 5000 });

		const loader = async () => {
			await new Promise(r => setTimeout(r, 10));
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
