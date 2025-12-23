import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$lib/config/env';

/**
 * Security headers configuration
 * Based on modern web security best practices
 */
export const SECURITY_HEADERS = {
	// Content Security Policy - Enhanced protective policy
	'Content-Security-Policy': `
		default-src 'self';
		script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com;
		style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
		img-src 'self' data: https: blob:;
		font-src 'self' https://fonts.gstatic.com;
		connect-src 'self' https: wss:;
		frame-src 'self' https://www.youtube.com https://player.vimeo.com;
		media-src 'self' https: blob:;
		object-src 'none';
		base-uri 'self';
		form-action 'self';
		frame-ancestors 'none';
		upgrade-insecure-requests;
		block-all-mixed-content
	`.replace(/\s+/g, ' ').trim(),

	// XSS Protection - Disable legacy XSS auditor
	'X-XSS-Protection': '0',

	// Prevent MIME type sniffing
	'X-Content-Type-Options': 'nosniff',

	// Prevent clickjacking
	'X-Frame-Options': 'DENY',

	// Referrer Policy - More restrictive
	'Referrer-Policy': 'strict-origin',

	// Permissions Policy - More restrictive
	'Permissions-Policy': `
		geolocation=(),
		microphone=(),
		camera=(),
		payment=(),
		usb=(),
		magnetometer=(),
		gyroscope=(),
		accelerometer=(),
		ambient-light-sensor=(),
		battery=(),
		screen-wake-lock=()
	`.replace(/\s+/g, ' ').trim(),

	// Strict Transport Security (in production)
	'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',

	// Cross-Origin Resource Policy
	'Cross-Origin-Resource-Policy': 'same-origin',

	// Cross-Origin Embedder Policy
	'Cross-Origin-Embedder-Policy': 'require-corp',

	// Cross-Origin Opener Policy
	'Cross-Origin-Opener-Policy': 'same-origin',

	// Origin-Agent-Cluster
	'Origin-Agent-Cluster': '?1',

	// Server header removal
	'Server': '',

	// X-Powered-By header removal
	'X-Powered-By': '',

	// X-Download-Options
	'X-Download-Options': 'noopen',

	// X-Permitted-Cross-Domain-Policies
	'X-Permitted-Cross-Domain-Policies': 'none'
};

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(event: RequestEvent, response: Response): Response {
	// Clone the response to modify headers
	const headers = new Headers(response.headers);

	// Apply security headers
	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		if (value) {
			headers.set(key, value);
		} else {
			headers.delete(key);
		}
	}

	// In development, don't set HSTS header
	if (import.meta.env.DEV) {
		headers.delete('Strict-Transport-Security');
	}

	// Add dynamic CSP for TMDB resources
	if (env.TMDB_IMAGE_BASE_URL) {
		const currentCsp = headers.get('Content-Security-Policy') || '';
		const updatedCsp = currentCsp.replace(
			/img-src 'self' data: https: blob:/,
			`img-src 'self' data: https: blob: ${env.TMDB_IMAGE_BASE_URL.replace(/https?:\/\//, '')}`
		);
		headers.set('Content-Security-Policy', updatedCsp);
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

/**
 * Generate security headers for specific content types
 */
export function getContentSecurityHeaders(contentType: 'api' | 'html' | 'embed' = 'html') {
	const baseHeaders = { ...SECURITY_HEADERS };

	switch (contentType) {
		case 'api':
			// More restrictive CSP for API responses
			baseHeaders['Content-Security-Policy'] = `
				default-src 'none';
				connect-src 'self';
				frame-ancestors 'none'
			`.replace(/\s+/g, ' ').trim();
			break;

		case 'embed':
			// Less restrictive CSP for embed content
			baseHeaders['Content-Security-Policy'] = `
				default-src 'self';
				script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
				style-src 'self' 'unsafe-inline' https:;
				img-src 'self' data: https: blob:;
				font-src 'self' https:;
				connect-src 'self' https:;
				frame-src 'self' https:;
				media-src 'self' https: blob:;
				object-src 'none';
				base-uri 'self';
				form-action 'none';
				frame-ancestors 'none'
			`.replace(/\s+/g, ' ').trim();
			break;
	}

	return baseHeaders;
}

/**
 * Security headers validation utility
 */
export function validateSecurityHeaders(headers: Headers): { valid: boolean; missing: string[] } {
	const requiredHeaders = [
		'Content-Security-Policy',
		'X-XSS-Protection',
		'X-Content-Type-Options',
		'X-Frame-Options',
		'Referrer-Policy',
		'Permissions-Policy'
	];

	const missingHeaders = requiredHeaders.filter(header => !headers.has(header));

	return {
		valid: missingHeaders.length === 0,
		missing: missingHeaders
	};
}
