import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
	validateInput,
	validateAndSanitizeInput,
	tmdbIdSchema,
	imdbIdSchema,
	searchQuerySchema,
	isValidTmdbId,
	isValidImdbId,
	validateAndExtractApiKey
} from './validation';
import { ValidationError } from './error-handler';

describe('validation utils', () => {
	describe('validateInput', () => {
		const schema = z.object({
			name: z.string().min(1),
			age: z.number().positive()
		});

		it('should validate and return data on success', () => {
			const data = { name: 'Test', age: 25 };
			const result = validateInput(schema, data);
			expect(result).toEqual(data);
		});

		it('should throw ValidationError on failure', () => {
			const data = { name: '', age: -1 };
			expect(() => validateInput(schema, data)).toThrow(ValidationError);
		});
	});

	describe('validateAndSanitizeInput', () => {
		const schema = z.object({
			comment: z.string()
		});

		it('should sanitize HTML characters in strings', () => {
			const data = { comment: '<script>alert("xss")</script>' };
			const result = validateAndSanitizeInput(schema, data);
			expect(result.comment).toContain('&#x2F;');
			expect(result.comment).toContain('&quot;');
			expect(result.comment).not.toContain('"');
		});
	});

	describe('tmdbIdSchema', () => {
		it('should validate positive integers', () => {
			expect(tmdbIdSchema.parse(123)).toBe(123);
			expect(tmdbIdSchema.parse('456')).toBe(456);
		});

		it('should fail on invalid tmdb ids', () => {
			expect(() => tmdbIdSchema.parse(-1)).toThrow();
			expect(() => tmdbIdSchema.parse('abc')).toThrow();
		});
	});

	describe('imdbIdSchema', () => {
		it('should validate valid IMDB IDs', () => {
			expect(imdbIdSchema.parse('tt1234567')).toBe('tt1234567');
			expect(imdbIdSchema.parse('tt12345678')).toBe('tt12345678');
		});

		it('should fail on invalid IMDB IDs', () => {
			expect(() => imdbIdSchema.parse('1234567')).toThrow();
			expect(() => imdbIdSchema.parse('tt123')).toThrow();
		});
	});

	describe('validateAndExtractApiKey', () => {
		it('should extract valid API key', () => {
			const key = 'a'.repeat(32);
			expect(validateAndExtractApiKey(`Bearer ${key}`)).toBe(key);
		});

		it('should throw on invalid format', () => {
			expect(() => validateAndExtractApiKey('InvalidKey')).toThrow(ValidationError);
			expect(() => validateAndExtractApiKey('Bearer short')).toThrow(ValidationError);
		});
	});

	describe('isValid functions', () => {
		it('isValidTmdbId should work correctly', () => {
			expect(isValidTmdbId(123)).toBe(true);
			expect(isValidTmdbId(0)).toBe(false);
			expect(isValidTmdbId('123')).toBe(false);
		});

		it('isValidImdbId should work correctly', () => {
			expect(isValidImdbId('tt1234567')).toBe(true);
			expect(isValidImdbId('tt123')).toBe(false);
			expect(isValidImdbId(123)).toBe(false);
		});
	});
});
