import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest';
import { SQL, StringChunk } from 'drizzle-orm/sql';

const mockedDbAll = vi.fn().mockResolvedValue([]);

vi.mock('$lib/server/db', () => ({
	db: {
		all: mockedDbAll
	}
}));

const cacheMock = {
	withCache: vi
		.fn()
		.mockImplementation(async (_key: string, _ttl: number, factory: () => Promise<any>) =>
			factory()
		),
	buildCacheKey: vi.fn((...parts: unknown[]) => parts.join('|')),
	CACHE_TTL_SEARCH_SECONDS: 1,
	CACHE_TTL_LONG_SECONDS: 1,
	CACHE_TTL_MEDIUM_SECONDS: 1,
	CACHE_TTL_SHORT_SECONDS: 1
};

vi.mock('$lib/server/cache', () => cacheMock);

let enhancedSearchFn: typeof import('$lib/server/services/search.service').enhancedSearch;

beforeAll(async () => {
	const module = await import('$lib/server/services/search.service');
	enhancedSearchFn = module.enhancedSearch;
});

describe('enhancedSearch security', () => {
	beforeEach(() => {
		mockedDbAll.mockReset();
		mockedDbAll.mockResolvedValue([]);
	});

	it('parameterizes genre filters to block injection strings', async () => {
		const maliciousGenre = '1; DROP TABLE media;';

		const result = await enhancedSearchFn({
			query: 'action',
			genres: [maliciousGenre],
			limit: 3,
			offset: 0
		});

		expect(result.results).toEqual([]);
		expect(result.total).toBe(0);
		expect(mockedDbAll).toHaveBeenCalled();

		for (const [query] of mockedDbAll.mock.calls) {
			const fragments = collectStringFragments(query as SQL);
			expect(fragments.join(' ').toLowerCase()).not.toContain('drop table');
		}
	});

	it('normalizes sort parameters before building raw SQL', async () => {
		const maliciousSortBy = 'rating; DROP TABLE providers;';
		const maliciousSortOrder = 'desc; DROP TABLE streams;';

		const result = await enhancedSearchFn({
			query: 'thriller',
			sortBy: maliciousSortBy as any,
			sortOrder: maliciousSortOrder as any,
			limit: 3,
			offset: 0
		});

		expect(result.results).toEqual([]);
		expect(result.total).toBe(0);
		expect(mockedDbAll).toHaveBeenCalled();

		for (const [query] of mockedDbAll.mock.calls) {
			const fragments = collectStringFragments(query as SQL);
			expect(fragments.join(' ').toLowerCase()).not.toContain('drop table');
		}
	});
});

function collectStringFragments(query: SQL | unknown): string[] {
	if (!query || typeof query !== 'object') return [];

	const chunks: string[] = [];
	for (const chunk of (query as SQL).queryChunks ?? []) {
		if (chunk instanceof StringChunk) {
			chunks.push(...chunk.value);
		} else if (chunk && typeof chunk === 'object' && 'queryChunks' in chunk) {
			chunks.push(...collectStringFragments(chunk as SQL));
		}
	}
	return chunks;
}
