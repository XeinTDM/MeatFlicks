import { describe, expect, it, vi } from 'vitest';
import { withCache, getCachedValue, deleteCachedValue } from '$lib/server/cache';

describe('withCache', () => {
	it('returns cached value after first call', async () => {
		const key = 'test-cache-key';
		await deleteCachedValue(key);

		const factory = vi.fn().mockResolvedValue(42);

		const first = await withCache(key, 60, factory);
		expect(first).toBe(42);
		expect(factory).toHaveBeenCalledTimes(1);

		const second = await withCache(key, 60, factory);
		expect(second).toBe(42);
		expect(factory).toHaveBeenCalledTimes(1);
	});

	it('deduplicates concurrent calls', async () => {
		const key = 'test-concurrent-key';
		await deleteCachedValue(key);

		let calls = 0;
		const factory = async () => {
			await new Promise(r => setTimeout(r, 50));
			calls += 1;
			return 'result';
		};

		const [res1, res2] = await Promise.all([
			withCache(key, 60, factory),
			withCache(key, 60, factory)
		]);

		expect(res1).toBe('result');
		expect(res2).toBe('result');
		expect(calls).toBe(1);
	});
});
