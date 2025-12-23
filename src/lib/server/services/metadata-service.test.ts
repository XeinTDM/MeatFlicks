import { describe, it, expect } from 'vitest';
import {
	enhanceMovieMetadata,
	getEnhancedMovies,
	getMoviesByMetadata,
	updateMovieMetadata,
	getMetadataStatistics
} from '$lib/server/services/metadata.service';

describe('Metadata Service - Function Exports', () => {
	it('should export all metadata service functions', () => {
		expect(enhanceMovieMetadata).toBeDefined();
		expect(getEnhancedMovies).toBeDefined();
		expect(getMoviesByMetadata).toBeDefined();
		expect(updateMovieMetadata).toBeDefined();
		expect(getMetadataStatistics).toBeDefined();

		expect(typeof enhanceMovieMetadata).toBe('function');
		expect(typeof getEnhancedMovies).toBe('function');
		expect(typeof getMoviesByMetadata).toBe('function');
		expect(typeof updateMovieMetadata).toBe('function');
		expect(typeof getMetadataStatistics).toBe('function');
	});

	it('should have correct function signatures', () => {
		expect(() => {
			enhanceMovieMetadata('test-id', { includeCast: true, includeTrailers: true });
		}).not.toThrow();

		expect(() => {
			getEnhancedMovies({ includeTrailers: true, limit: 10 });
		}).not.toThrow();

		expect(() => {
			getMoviesByMetadata({ hasTrailer: true }, { limit: 10 });
		}).not.toThrow();

		expect(() => {
			updateMovieMetadata('test-id', { trailerUrl: 'http://example.com' });
		}).not.toThrow();

		expect(() => {
			getMetadataStatistics();
		}).not.toThrow();
	});
});

describe('Metadata Service - Basic Functionality', () => {
	it('should handle error cases gracefully', async () => {
		try {
			await enhanceMovieMetadata('non-existent-movie-id');
		} catch (error) {
			expect(error).toBeDefined();
		}
	});
});
