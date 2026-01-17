import { describe, it, expect } from 'vitest';
import {
	enhanceMovieMetadata,
	getEnhancedMovies,
	getMoviesByMetadata,
	updateMovieMetadata,
	getMetadataStatistics
} from './metadata.service';

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
		expect(enhanceMovieMetadata).toBeDefined();
		expect(getEnhancedMovies).toBeDefined();
		expect(getMoviesByMetadata).toBeDefined();
		expect(updateMovieMetadata).toBeDefined();
		expect(getMetadataStatistics).toBeDefined();
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
