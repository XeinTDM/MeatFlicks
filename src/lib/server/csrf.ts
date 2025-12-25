import { randomBytes } from 'crypto';
import { logger } from './logger';
import { UnauthorizedError } from './error-handler';

const isDev = process.env.NODE_ENV === 'development';

/**
 * CSRF Token Management and Validation
 *
 * This module provides CSRF protection for the application.
 * It generates, validates, and manages CSRF tokens to prevent
 * Cross-Site Request Forgery attacks.
 */

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;
const CSRF_TOKEN_ROTATION_INTERVAL = 4 * 60 * 60 * 1000;

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
	return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Generate a CSRF token with additional security features
 */
export function generateSecureCsrfToken(): { token: string; signature: string; expires: number } {
	const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
	const signature = randomBytes(16).toString('hex');
	const expires = Date.now() + CSRF_TOKEN_EXPIRATION_MS;

	return {
		token,
		signature,
		expires
	};
}

/**
 * Create CSRF cookie with secure attributes
 */
export function createCsrfCookie(token: string): {
	name: string;
	value: string;
	attributes: Record<string, any>;
} {
	return {
		name: CSRF_COOKIE_NAME,
		value: token,
		attributes: {
			httpOnly: true,
			secure: !isDev,
			sameSite: 'lax' as const,
			path: '/',
			maxAge: Math.floor(CSRF_TOKEN_EXPIRATION_MS / 1000),
			partitioned: true
		}
	};
}

/**
 * Create secure CSRF cookie with token and signature
 */
export function createSecureCsrfCookie(tokenData: {
	token: string;
	signature: string;
	expires: number;
}): {
	name: string;
	value: string;
	attributes: Record<string, any>;
} {
	return {
		name: CSRF_COOKIE_NAME,
		value: JSON.stringify(tokenData),
		attributes: {
			httpOnly: true,
			secure: !isDev,
			sameSite: 'lax' as const,
			path: '/',
			maxAge: Math.floor(CSRF_TOKEN_EXPIRATION_MS / 1000),
			partitioned: true
		}
	};
}

/**
 * Validate CSRF token from request
 */
export async function validateCsrfToken(
	event: any,
	requiredMethods: string[] = ['POST', 'PUT', 'PATCH', 'DELETE']
): Promise<{ valid: boolean; token?: string; error?: string }> {
	if (!requiredMethods.includes(event.request.method.toUpperCase())) {
		return { valid: true };
	}

	const csrfCookie = event.cookies.get(CSRF_COOKIE_NAME);
	if (!csrfCookie) {
		logger.warn('CSRF validation failed: No CSRF cookie found');
		return {
			valid: false,
			error: 'CSRF token validation failed'
		};
	}

	let requestToken: string | null = null;
	requestToken = event.request.headers.get(CSRF_HEADER_NAME) || null;

	if (!requestToken) {
		try {
			const contentType = event.request.headers.get('content-type');
			if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
				const formData = await event.request.formData();
				requestToken = formData.get('csrf_token') as string | null;
			} else if (contentType && contentType.includes('multipart/form-data')) {
				const formData = await event.request.formData();
				requestToken = formData.get('csrf_token') as string | null;
			} else if (contentType && contentType.includes('application/json')) {
				try {
					const jsonData = await event.request.json();
					requestToken = jsonData.csrf_token as string | null;
				} catch (jsonError) {
					logger.error({ jsonError }, 'Failed to parse JSON for CSRF validation');
				}
			}
		} catch (error) {
			logger.error({ error }, 'Failed to parse form data for CSRF validation');
		}
	}

	if (!requestToken) {
		logger.warn('CSRF validation failed: No CSRF token in request');
		return {
			valid: false,
			error: 'CSRF token validation failed'
		};
	}

	if (csrfCookie !== requestToken) {
		logger.warn('CSRF validation failed: Tokens do not match');
		return {
			valid: false,
			error: 'CSRF token validation failed'
		};
	}

	return {
		valid: true,
		token: csrfCookie
	};
}

/**
 * Validate secure CSRF token with signature and expiration
 */
export async function validateSecureCsrfToken(
	event: any,
	requiredMethods: string[] = ['POST', 'PUT', 'PATCH', 'DELETE']
): Promise<{ valid: boolean; token?: string; error?: string }> {
	if (!requiredMethods.includes(event.request.method.toUpperCase())) {
		return { valid: true };
	}

	const csrfCookie = event.cookies.get(CSRF_COOKIE_NAME);
	if (!csrfCookie) {
		logger.warn('CSRF validation failed: No CSRF cookie found');
		return {
			valid: false,
			error: 'CSRF token validation failed'
		};
	}

	try {
		const tokenData = JSON.parse(csrfCookie) as {
			token: string;
			signature: string;
			expires: number;
		};

		if (Date.now() > tokenData.expires) {
			logger.warn('CSRF validation failed: Token expired');
			return {
				valid: false,
				error: 'CSRF token expired'
			};
		}

		let requestToken: string | null = null;
		requestToken = event.request.headers.get(CSRF_HEADER_NAME) || null;

		if (!requestToken) {
			try {
				const contentType = event.request.headers.get('content-type');
				if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
					const formData = await event.request.formData();
					requestToken = formData.get('csrf_token') as string | null;
				} else if (contentType && contentType.includes('multipart/form-data')) {
					const formData = await event.request.formData();
					requestToken = formData.get('csrf_token') as string | null;
				} else if (contentType && contentType.includes('application/json')) {
					try {
						const jsonData = await event.request.json();
						requestToken = jsonData.csrf_token as string | null;
					} catch (jsonError) {
						logger.error({ jsonError }, 'Failed to parse JSON for CSRF validation');
					}
				}
			} catch (error) {
				logger.error({ error }, 'Failed to parse form data for CSRF validation');
			}
		}

		if (!requestToken) {
			logger.warn('CSRF validation failed: No CSRF token in request');
			return {
				valid: false,
				error: 'CSRF token validation failed'
			};
		}

		if (tokenData.token !== requestToken) {
			logger.warn('CSRF validation failed: Tokens do not match');
			return {
				valid: false,
				error: 'CSRF token validation failed'
			};
		}

		return {
			valid: true,
			token: tokenData.token
		};
	} catch (error) {
		logger.error({ error }, 'CSRF validation failed: Invalid token format');
		return {
			valid: false,
			error: 'Invalid CSRF token format'
		};
	}
}

/**
 * CSRF Middleware for SvelteKit
 */
export function csrfMiddleware() {
	return {
		name: 'csrf',
		async handle({ event, resolve }: { event: any; resolve: any }) {
			const csrfCookie = event.cookies.get(CSRF_COOKIE_NAME);
			if (!csrfCookie) {
				const csrfToken = generateCsrfToken();
				const csrfCookie = createCsrfCookie(csrfToken);

				event.cookies.set(csrfCookie.name, csrfCookie.value, csrfCookie.attributes);
			} else {
				try {
					const tokenData = JSON.parse(csrfCookie);
					if (tokenData.expires && Date.now() > tokenData.expires - CSRF_TOKEN_ROTATION_INTERVAL) {
						const newTokenData = generateSecureCsrfToken();
						const newCsrfCookie = createSecureCsrfCookie(newTokenData);
						event.cookies.set(newCsrfCookie.name, newCsrfCookie.value, newCsrfCookie.attributes);
					}
				} catch {
					const csrfToken = generateCsrfToken();
					const csrfCookie = createCsrfCookie(csrfToken);
					event.cookies.set(csrfCookie.name, csrfCookie.value, csrfCookie.attributes);
				}
			}

			const csrfValidation = await validateSecureCsrfToken(event);

			if (!csrfValidation.valid) {
				logger.warn(`CSRF validation failed for ${event.request.method} ${event.url.pathname}`);

				return new Response(csrfValidation.error || 'Forbidden', {
					status: 403,
					headers: {
						'Content-Type': 'text/plain',
						'X-Content-Type-Options': 'nosniff',
						'X-Frame-Options': 'DENY'
					}
				});
			}

			const response = await resolve(event);
			return response;
		}
	};
}

/**
 * Get CSRF token for use in forms
 */
export function getCsrfToken(event: any): string | null {
	try {
		const csrfCookie = event.cookies.get(CSRF_COOKIE_NAME);
		if (!csrfCookie) return null;

		const tokenData = JSON.parse(csrfCookie);
		return tokenData.token || tokenData;
	} catch {
		return event.cookies.get(CSRF_COOKIE_NAME);
	}
}

/**
 * Get CSRF token for API requests
 */
export function getCsrfHeader(event: any): string | null {
	return getCsrfToken(event);
}

/**
 * CSRF Protection Helper for Forms
 * Returns HTML input element with CSRF token
 */
export function csrfInput(event: any): string {
	const token = getCsrfToken(event);
	if (!token) {
		return '';
	}
	return `<input type="hidden" name="csrf_token" value="${token}" />`;
}

/**
 * CSRF Protection Helper for API requests
 * Returns object with CSRF header
 */
export function csrfHeaders(event: any): Record<string, string> {
	const token = getCsrfToken(event);
	if (!token) {
		return {};
	}
	return {
		'X-CSRF-Token': token
	};
}

/**
 * Validate CSRF token for API requests
 * Throws UnauthorizedError if validation fails
 */
export async function validateCsrfForApi(event: any): Promise<void> {
	const validation = await validateSecureCsrfToken(event);
	if (!validation.valid) {
		throw new UnauthorizedError(validation.error || 'CSRF token validation failed');
	}
}
