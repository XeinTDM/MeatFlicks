import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import {
	validateInput,
	validateAndSanitizeInput,
	validateAndExtractApiKey,
	validateContentType,
	validateRequestOrigin
} from '$lib/server/validation';
import { securityUtils } from '$lib/server/security-utils';
import {
	validateCsrfToken,
	validateSecureCsrfToken,
	generateSecureCsrfToken,
	createSecureCsrfCookie
} from '$lib/server/csrf';
import { RateLimiter } from '$lib/server/rate-limiter';
import { applySecurityHeaders, validateSecurityHeaders } from '$lib/server/security-headers';

describe('Security Enhancements', () => {
	describe('Input Validation and Sanitization', () => {
		it('should validate and sanitize user input', () => {
			const testInput = {
				name: '<script>alert("xss")</script>',
				email: 'test@example.com',
				description: 'This is a <b>test</b> with & special chars'
			};

			const result = validateAndSanitizeInput(
				z.object({
					name: z.string(),
					email: z.string().email(),
					description: z.string()
				}),
				testInput
			);

			expect(result.name).toBe('<script>alert("xss")</script>');
			expect(result.email).toBe('test@example.com');
			expect(result.description).toBe('This is a <b>test</b> with & special chars');
		});

		it('should throw validation error for invalid input', () => {
			expect(() => {
				validateInput(z.object({ email: z.string().email() }), { email: 'invalid-email' });
			}).toThrow();
		});
	});

	describe('API Key Validation', () => {
		it('should validate and extract API key from Bearer token', () => {
			const apiKey = 'test-api-key-12345678901234567890123456789012';
			const result = validateAndExtractApiKey(`Bearer ${apiKey}`);
			expect(result).toBe(apiKey);
		});

		it('should throw error for invalid API key format', () => {
			expect(() => validateAndExtractApiKey('InvalidFormat')).toThrow();
			expect(() => validateAndExtractApiKey('Bearer')).toThrow();
			expect(() => validateAndExtractApiKey(null)).toThrow();
		});
	});

	describe('Content Type Validation', () => {
		it('should validate content type headers', () => {
			expect(() => validateContentType('application/json', ['application/json'])).not.toThrow();
			expect(() =>
				validateContentType('application/json; charset=utf-8', ['application/json'])
			).not.toThrow();
		});

		it('should throw error for invalid content types', () => {
			expect(() => validateContentType('text/html', ['application/json'])).toThrow();
			expect(() => validateContentType(null, ['application/json'])).toThrow();
		});
	});

	describe('Request Origin Validation', () => {
		it('should validate allowed origins', () => {
			expect(() =>
				validateRequestOrigin('https://meatflicks.com', ['https://meatflicks.com'])
			).not.toThrow();
		});

		it('should throw error for disallowed origins', () => {
			expect(() => validateRequestOrigin('https://evil.com', ['https://meatflicks.com'])).toThrow();
			expect(() => validateRequestOrigin(null, ['https://meatflicks.com'])).toThrow();
			expect(() => validateRequestOrigin('invalid-url', ['https://meatflicks.com'])).toThrow();
		});
	});

	describe('Security Utilities', () => {
		it('should generate secure tokens', () => {
			const token1 = securityUtils.generateSecureToken(32);
			const token2 = securityUtils.generateSecureToken(32);

			expect(token1).toHaveLength(64);
			expect(token2).toHaveLength(64);
			expect(token1).not.toBe(token2);
		});

		it('should create and verify HMAC signatures', () => {
			const data = 'test-data';
			const secret = 'test-secret';
			const signature = securityUtils.createHmacSignature(data, secret);

			expect(securityUtils.verifyHmacSignature(data, secret, signature)).toBe(true);
			expect(securityUtils.verifyHmacSignature(data, 'wrong-secret', signature)).toBe(false);
		});

		it('should perform timing-safe string comparison', () => {
			expect(securityUtils.timingSafeEqual('test', 'test')).toBe(true);
			expect(securityUtils.timingSafeEqual('test', 'wrong')).toBe(false);
		});

		it('should sanitize input to prevent XSS', () => {
			const dangerousInput = '<script>alert("xss")</script>';
			const sanitized = securityUtils.sanitizeInput(dangerousInput);
			expect(sanitized).toBe('<script>alert("xss")</script>');
		});

		it('should validate email format', () => {
			expect(securityUtils.validateEmail('test@example.com')).toBe(true);
			expect(securityUtils.validateEmail('invalid-email')).toBe(false);
		});

		it('should validate password strength', () => {
			const weakPassword = securityUtils.validatePasswordStrength('password');
			expect(weakPassword.valid).toBe(false);

			const strongPassword = securityUtils.validatePasswordStrength('StrongP@ssw0rd123!');
			expect(strongPassword.valid).toBe(true);
		});

		it('should generate and verify password hashes', () => {
			const { hash, salt } = securityUtils.generatePasswordHash('test-password');
			expect(securityUtils.verifyPassword('test-password', hash, salt)).toBe(true);
			expect(securityUtils.verifyPassword('wrong-password', hash, salt)).toBe(false);
		});
	});

	describe('CSRF Protection', () => {
		it('should generate secure CSRF tokens', () => {
			const tokenData = generateSecureCsrfToken();
			expect(tokenData.token).toHaveLength(64);
			expect(tokenData.signature).toHaveLength(32);
			expect(tokenData.expires).toBeGreaterThan(Date.now());
		});

		it('should create secure CSRF cookies', () => {
			const tokenData = generateSecureCsrfToken();
			const cookie = createSecureCsrfCookie(tokenData);

			expect(cookie.name).toBe('csrf_token');
			expect(cookie.attributes.httpOnly).toBe(true);
			expect(cookie.attributes.secure).toBe(true);
			expect(cookie.attributes.partitioned).toBe(true);
		});

		it('should validate CSRF tokens', async () => {
			const mockEvent = {
				request: {
					method: 'POST',
					headers: new Headers(),
					formData: async () => new FormData(),
					json: async () => ({})
				},
				cookies: {
					get: (name: string) => (name === 'csrf_token' ? 'test-token' : null)
				}
			};

			mockEvent.request.headers.set('x-csrf-token', 'test-token');
			const result = await validateCsrfToken(mockEvent);
			expect(result.valid).toBe(true);

			mockEvent.request.headers.delete('x-csrf-token');
			mockEvent.request.headers.set('content-type', 'application/x-www-form-urlencoded');
			mockEvent.request.formData = async () => {
				const formData = new FormData();
				formData.append('csrf_token', 'test-token');
				return formData;
			};
			const formResult = await validateCsrfToken(mockEvent);
			expect(formResult.valid).toBe(true);

			mockEvent.request.headers.set('content-type', 'application/json');
			mockEvent.request.formData = async () => new FormData();
			mockEvent.request.json = async () => ({ csrf_token: 'test-token' });
			const jsonResult = await validateCsrfToken(mockEvent);
			expect(jsonResult.valid).toBe(true);
		});

		it('should reject invalid CSRF tokens', async () => {
			const mockEvent = {
				request: {
					method: 'POST',
					headers: new Headers(),
					formData: async () => new FormData(),
					json: async () => ({})
				},
				cookies: {
					get: (name: string) => (name === 'csrf_token' ? 'valid-token' : null)
				}
			};

			const noTokenResult = await validateCsrfToken(mockEvent);
			expect(noTokenResult.valid).toBe(false);

			mockEvent.request.headers.set('x-csrf-token', 'invalid-token');
			const mismatchResult = await validateCsrfToken(mockEvent);
			expect(mismatchResult.valid).toBe(false);
		});
	});

	describe('Rate Limiting', () => {
		it('should allow requests within rate limit', async () => {
			const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
			const result = await limiter.checkLimit('test-key');
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(4);
		});

		it('should reject requests exceeding rate limit', async () => {
			const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

			await limiter.checkLimit('test-key');
			await limiter.checkLimit('test-key');

			const result = await limiter.checkLimit('test-key');
			expect(result.allowed).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it('should apply penalties for rate limit violations', async () => {
			const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000, penaltyMs: 5000 });
			await limiter.checkLimit('test-key');
			const result = await limiter.checkLimit('test-key');
			expect(result.allowed).toBe(false);
			expect(result.resetTime).toBeDefined();
		});
	});

	describe('Security Headers', () => {
		it('should apply security headers to responses', () => {
			const mockEvent = {} as any;
			const response = new Response('test', {
				headers: { 'Content-Type': 'text/html' }
			});

			const securedResponse = applySecurityHeaders(mockEvent, response);

			expect(securedResponse.headers.get('Content-Security-Policy')).toContain(
				"default-src 'self'"
			);
			expect(securedResponse.headers.get('X-XSS-Protection')).toBe('0');
			expect(securedResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
			expect(securedResponse.headers.get('X-Frame-Options')).toBe('DENY');
		});

		it('should validate security headers', () => {
			const headers = new Headers();
			headers.set('Content-Security-Policy', "default-src 'self'");
			headers.set('X-XSS-Protection', '0');
			headers.set('X-Content-Type-Options', 'nosniff');
			headers.set('X-Frame-Options', 'DENY');
			headers.set('Referrer-Policy', 'strict-origin');
			headers.set('Permissions-Policy', 'geolocation=()');

			const result = validateSecurityHeaders(headers);
			expect(result.valid).toBe(true);
			expect(result.missing).toHaveLength(0);
		});

		it('should detect missing security headers', () => {
			const headers = new Headers();
			headers.set('Content-Security-Policy', "default-src 'self'");

			const result = validateSecurityHeaders(headers);
			expect(result.valid).toBe(false);
			expect(result.missing).toContain('X-XSS-Protection');
			expect(result.missing).toContain('X-Content-Type-Options');
		});
	});
});
