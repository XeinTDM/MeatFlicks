import { describe, it, expect } from 'vitest';
import { toSlug, fromSlug, createCollectionSlug } from './slug';

describe('slug utils', () => {
	describe('toSlug', () => {
		it('should convert strings to URL-friendly slugs', () => {
			expect(toSlug('Hello World')).toBe('hello-world');
			expect(toSlug('The Matrix (1999)')).toBe('the-matrix-1999');
			expect(toSlug('Some   Extra   Spaces')).toBe('some-extra-spaces');
			expect(toSlug('Accents: áéíóú')).toBe('accents-aeiou');
			expect(toSlug('Special Characters: @#$%^&*()')).toBe('special-characters');
		});

		it('should handle empty strings and whitespace', () => {
			expect(toSlug('')).toBe('');
			expect(toSlug('   ')).toBe('');
		});

		it('should trim leading and trailing dashes', () => {
			expect(toSlug('---hello---')).toBe('hello');
			expect(toSlug('! hello !')).toBe('hello');
		});
	});

	describe('fromSlug', () => {
		it('should convert slugs back to human-readable strings', () => {
			expect(fromSlug('hello-world')).toBe('Hello World');
			expect(fromSlug('the-matrix-1999')).toBe('The Matrix 1999');
			expect(fromSlug('some-extra-spaces')).toBe('Some Extra Spaces');
		});

		it('should handle empty strings', () => {
			expect(fromSlug('')).toBe('');
		});
	});

	describe('createCollectionSlug', () => {
		it('should create a slug for a collection name', () => {
			expect(createCollectionSlug('My Watchlist')).toBe('my-watchlist');
		});
	});
});
