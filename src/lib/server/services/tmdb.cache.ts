export async function invalidateTmdbCaches(pattern?: string): Promise<number> {
	const { invalidateCachePattern, invalidateCachePrefix } = await import('$lib/server/cache');

	if (pattern) {
		return invalidateCachePattern(pattern);
	}

	return invalidateCachePrefix('tmdb:');
}

export async function invalidateTmdbId(
	tmdbId: number,
	mediaType?: 'movie' | 'tv'
): Promise<number> {
	const { invalidateTmdbId: invalidateById } = await import('$lib/server/cache');
	return invalidateById(tmdbId, mediaType);
}
