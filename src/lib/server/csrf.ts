import { randomBytes } from 'crypto';
import type { RequestEvent, ResolveOptions } from '@sveltejs/kit';
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

type CsrfCookieAttributes = {
	httpOnly: true;
	secure: boolean;
	sameSite: 'lax';
	path: '/';
	maxAge: number;
	partitioned?: true;
};

type CsrfTokenPayload = {
	token: string;
	signature: string;
	expires: number;
};

type CsrfCookieStore = {
	get: (name: string) => string | null | undefined;
};

type CsrfCookieAccessor = {
	cookies: CsrfCookieStore;
};

type CsrfRequestAccessor = {
	request: CsrfRequest;
	cookies: CsrfCookieStore;
};

type MaybePromise<T> = T | Promise<T>;

type CsrfResolve = (event: RequestEvent, options?: ResolveOptions) => MaybePromise<Response>;

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
	attributes: CsrfCookieAttributes;
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
			...(!isDev ? { partitioned: true } : {})
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
	attributes: CsrfCookieAttributes;
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
			...(!isDev ? { partitioned: true } : {})
		}
	};
}

type CsrfRequest = {
	method: string;
	headers: Headers;
	clone?: () => CsrfRequest;
	formData?: () => Promise<FormData>;
	json?: () => Promise<Record<string, unknown>>;
};

async function readCsrfTokenFromBody(request: CsrfRequest): Promise<string | null> {
	const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
	if (!contentType) {
		return null;
	}

	try {
		if (contentType.includes('application/x-www-form-urlencoded')) {
			if (typeof request.formData !== 'function') return null;
			const formData = await request.formData();
			const token = formData.get('csrf_token');
			return typeof token === 'string' ? token : null;
		}

		if (contentType.includes('multipart/form-data')) {
			if (typeof request.formData !== 'function') return null;
			const formData = await request.formData();
			const token = formData.get('csrf_token');
			return typeof token === 'string' ? token : null;
		}

		if (contentType.includes('application/json')) {
			if (typeof request.json !== 'function') return null;
			const body = await request.json().catch((error) => {
				logger.error({ jsonError: error }, 'Failed to parse JSON for CSRF validation');
				return null;
			});
			if (body && typeof body === 'object') {
				const token = (body as Record<string, unknown>).csrf_token;
				return typeof token === 'string' ? token : null;
			}
		}
	} catch (error) {
		logger.error({ error }, 'Failed to parse request body for CSRF token');
	}

	return null;
}

async function extractCsrfTokenFromRequest(request: CsrfRequest): Promise<string | null> {
	const headerToken = request.headers.get(CSRF_HEADER_NAME);
	if (headerToken) {
		return headerToken;
	}

	const reader = typeof request.clone === 'function' ? request.clone() : request;
	return readCsrfTokenFromBody(reader);
}

export async function validateCsrfToken(
	event: CsrfRequestAccessor,
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

	const requestToken = await extractCsrfTokenFromRequest(event.request as CsrfRequest);

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

export async function validateSecureCsrfToken(
	event: CsrfRequestAccessor,
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
		const tokenData = JSON.parse(csrfCookie) as CsrfTokenPayload;

		if (Date.now() > tokenData.expires) {
			logger.warn('CSRF validation failed: Token expired');
			return {
				valid: false,
				error: 'CSRF token expired'
			};
		}

		const requestToken = await extractCsrfTokenFromRequest(event.request as CsrfRequest);

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

export function csrfMiddleware() {
	return {
		name: 'csrf',
		async handle({ event, resolve }: { event: RequestEvent; resolve: CsrfResolve }) {
			const csrfCookie = event.cookies.get(CSRF_COOKIE_NAME);
			if (!csrfCookie) {
				const csrfToken = generateSecureCsrfToken();
				const csrfCookie = createSecureCsrfCookie(csrfToken);

				event.cookies.set(csrfCookie.name, csrfCookie.value, csrfCookie.attributes);
			} else {
				try {
					const tokenData = JSON.parse(csrfCookie) as Partial<CsrfTokenPayload>;
					if (tokenData.expires && Date.now() > tokenData.expires - CSRF_TOKEN_ROTATION_INTERVAL) {
						const newTokenData = generateSecureCsrfToken();
						const newCsrfCookie = createSecureCsrfCookie(newTokenData);
						event.cookies.set(newCsrfCookie.name, newCsrfCookie.value, newCsrfCookie.attributes);
					}
				} catch {
					const csrfToken = generateSecureCsrfToken();
					const csrfCookie = createSecureCsrfCookie(csrfToken);
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

export function getCsrfToken(event: CsrfCookieAccessor): string | null {
	try {
		const csrfCookie = event.cookies.get(CSRF_COOKIE_NAME);
		if (!csrfCookie) return null;

		const parsed = JSON.parse(csrfCookie) as unknown;
		if (typeof parsed === 'string') {
			return parsed;
		}
		if (typeof parsed === 'object' && parsed !== null) {
			const data = parsed as Partial<CsrfTokenPayload>;
			if (typeof data.token === 'string') {
				return data.token;
			}
		}

		return null;
	} catch {
		return event.cookies.get(CSRF_COOKIE_NAME) ?? null;
	}
}

export function getCsrfHeader(event: CsrfCookieAccessor): string | null {
	return getCsrfToken(event);
}

export function csrfInput(event: CsrfCookieAccessor): string {
	const token = getCsrfToken(event);
	if (!token) {
		return '';
	}
	return `<input type="hidden" name="csrf_token" value="${token}" />`;
}

export function csrfHeaders(event: CsrfCookieAccessor): Record<string, string> {
	const token = getCsrfToken(event);
	if (!token) {
		return {};
	}
	return {
		'X-CSRF-Token': token
	};
}

export async function validateCsrfForApi(event: CsrfRequestAccessor): Promise<void> {
	const validation = await validateSecureCsrfToken(event);
	if (!validation.valid) {
		throw new UnauthorizedError(validation.error || 'CSRF token validation failed');
	}
}
