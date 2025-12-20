import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';

describe('CSRF Core Logic Tests', () => {
	it('should generate valid CSRF tokens', () => {
		const token1 = randomBytes(32).toString('hex');
		const token2 = randomBytes(32).toString('hex');

		expect(typeof token1).toBe('string');
		expect(token1.length).toBe(64);
		expect(token2.length).toBe(64);
		expect(token1).not.toBe(token2);
	});

	it('should validate token matching correctly', () => {
		const csrfToken = randomBytes(32).toString('hex');

		const validateToken = (cookieToken: string | null, requestToken: string | null) => {
			if (!cookieToken) return { valid: false, error: 'No CSRF cookie' };
			if (!requestToken) return { valid: false, error: 'No CSRF token in request' };
			if (cookieToken !== requestToken) return { valid: false, error: 'Tokens do not match' };
			return { valid: true, token: cookieToken };
		};

		const result1 = validateToken(csrfToken, csrfToken);
		expect(result1.valid).toBe(true);
		expect(result1.token).toBe(csrfToken);

		const result2 = validateToken(null, csrfToken);
		expect(result2.valid).toBe(false);

		const result3 = validateToken(csrfToken, null);
		expect(result3.valid).toBe(false);

		const differentToken = randomBytes(32).toString('hex');
		const result4 = validateToken(csrfToken, differentToken);
		expect(result4.valid).toBe(false);
	});

	it('should skip validation for safe HTTP methods', () => {
		const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
		const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

		const shouldValidate = (method: string) => {
			return unsafeMethods.includes(method.toUpperCase());
		};

		safeMethods.forEach(method => {
			expect(shouldValidate(method)).toBe(false);
		});

		unsafeMethods.forEach(method => {
			expect(shouldValidate(method)).toBe(true);
		});
	});

	it('should create secure cookie attributes', () => {
		const token = randomBytes(32).toString('hex');
		const dev = true;

		const createCookieAttributes = () => ({
			httpOnly: true,
			secure: !dev,
			sameSite: 'lax' as const,
			path: '/',
			maxAge: Math.floor(24 * 60 * 60 * 1000 / 1000)
		});

		const attributes = createCookieAttributes();

		expect(attributes.httpOnly).toBe(true);
		expect(attributes.secure).toBe(false);
		expect(attributes.sameSite).toBe('lax');
		expect(attributes.path).toBe('/');
		expect(attributes.maxAge).toBe(86400);
	});
});
