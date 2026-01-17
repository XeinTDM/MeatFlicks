import { describe, it, expect } from 'vitest';
import { toNumber, clone, ApiError, ValidationError, safeParseApiResponse } from './utils';

describe('server utils', () => {
	describe('toNumber', () => {
		it('should convert valid inputs to numbers', () => {
			expect(toNumber('123')).toBe(123);
			expect(toNumber(123)).toBe(123);
			expect(toNumber('12.3')).toBe(12.3);
		});

		it('should return null for invalid inputs', () => {
			expect(toNumber('abc')).toBeNull();
			expect(toNumber(undefined)).toBeNull();
			expect(toNumber(null)).toBeNull();
			expect(toNumber({})).toBeNull();
			expect(toNumber(NaN)).toBeNull();
			expect(toNumber(Infinity)).toBeNull();
		});
	});

	describe('clone', () => {
		it('should deep clone objects', () => {
			const original = { a: 1, b: { c: 2 }, d: [3, 4] };
			const cloned = clone(original);

			expect(cloned).toEqual(original);
			expect(cloned).not.toBe(original);
			expect(cloned.b).not.toBe(original.b);
			expect(cloned.d).not.toBe(original.d);
		});

		it('should handle primitives', () => {
			expect(clone(123)).toBe(123);
			expect(clone('hello')).toBe('hello');
			expect(clone(true)).toBe(true);
			expect(clone(null)).toBe(null);
		});
	});

	describe('ApiError', () => {
		it('should create an error with status code and message', () => {
			const error = new ApiError('Not Found', 404, 'NOT_FOUND');
			expect(error.message).toBe('Not Found');
			expect(error.statusCode).toBe(404);
			expect(error.code).toBe('NOT_FOUND');
			expect(error.name).toBe('ApiError');
		});
	});

	describe('ValidationError', () => {
		it('should create an error with field and message', () => {
			const error = new ValidationError('Invalid email', 'email');
			expect(error.message).toBe('Invalid email');
			expect(error.field).toBe('email');
			expect(error.name).toBe('ValidationError');
		});
	});

	describe('safeParseApiResponse', () => {
		it('should return success and data on valid parse', () => {
			const response = { id: '123', name: 'Test' };
			const parseFn = (data: any) => ({
				id: String(data.id),
				name: String(data.name)
			});

			const result = safeParseApiResponse(response, parseFn);
			expect(result.success).toBe(true);
			expect(result.data).toEqual({ id: '123', name: 'Test' });
			expect(result.error).toBeUndefined();
		});

		it('should return failure and error message on parse error', () => {
			const response = { id: '123' };
			const parseFn = (data: any) => {
				if (!data.name) throw new Error('Missing name');
				return data;
			};

			const result = safeParseApiResponse(response, parseFn);
			expect(result.success).toBe(false);
			expect(result.data).toBeNull();
			expect(result.error).toBe('Missing name');
		});
	});
});
