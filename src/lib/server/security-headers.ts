import type { RequestEvent } from '@sveltejs/kit';

/**
 * Security headers configuration
 * Based on modern web security best practices
 */
export const SECURITY_HEADERS = {
	// Content Security Policy - Basic protective policy
	'Content-Security-Policy': `
		default-src 'self';
		script-src 'self' 'unsafe-inline' 'unsafe-eval';
		style-src 'self' 'unsafe-inline';
		img-src 'self' data: https:;
		font-src 'self' https:;
		connect-src 'self' https:;
		frame-src 'self' https:;
		object-src 'none';
		base-uri 'self';
		form-action 'self';
		frame-ancestors 'none'
	`.replace(/\s+/g, ' ').trim(),

	// XSS Protection
	'X-XSS-Protection': '0',

	// Prevent MIME type sniffing
	'X-Content-Type-Options': 'nosniff',

	// Prevent clickjacking
	'X-Frame-Options': 'DENY',

	// Referrer Policy
	'Referrer-Policy': 'strict-origin-when-cross-origin',

	// Permissions Policy
	'Permissions-Policy': `
		geolocation=(),
		microphone=(),
		camera=(),
		payment=(),
		usb=()
	`.replace(/\s+/g, ' ').trim(),

	// Strict Transport Security (in production)
	'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
};

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(event: RequestEvent, response: Response): Response {
	// Clone the response to modify headers
	const headers = new Headers(response.headers);

	// Apply security headers
	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		headers.set(key, value);
	}

	// In development, don't set HSTS header
	if (import.meta.env.DEV) {
		headers.delete('Strict-Transport-Security');
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: headers
	});
}

/**
 * Middleware to add security headers to all responses
 */
export function securityHeadersMiddleware() {
	return {
		applySecurityHeaders
	};
}
