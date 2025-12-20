import { randomBytes } from 'crypto';
import { dev } from '$app/environment';
import { logger } from './logger';

/**
 * CSRF Token Management and Validation
 *
 * This module provides CSRF protection for the application.
 * It generates, validates, and manages CSRF tokens to prevent
 * Cross-Site Request Forgery attacks.
 */

const CSRF_TOKEN_LENGTH = 32; // bytes (64 characters when hex encoded)
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
	return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
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
			secure: !dev,
			sameSite: 'lax' as const,
			path: '/',
			maxAge: Math.floor(CSRF_TOKEN_EXPIRATION_MS / 1000)
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
 * CSRF Middleware for SvelteKit
 */
export function csrfMiddleware() {
	return {
		name: 'csrf',
		async handle({ event, resolve }: { event: any; resolve: any }) {
			if (!event.cookies.get(CSRF_COOKIE_NAME)) {
				const csrfToken = generateCsrfToken();
				const csrfCookie = createCsrfCookie(csrfToken);

				event.cookies.set(csrfCookie.name, csrfCookie.value, csrfCookie.attributes);
			}

			const csrfValidation = await validateCsrfToken(event);

			if (!csrfValidation.valid) {
				logger.warn(`CSRF validation failed for ${event.request.method} ${event.url.pathname}`);

				return new Response(csrfValidation.error || 'Forbidden', {
					status: 403,
					headers: {
						'Content-Type': 'text/plain'
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
	return event.cookies.get(CSRF_COOKIE_NAME);
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
