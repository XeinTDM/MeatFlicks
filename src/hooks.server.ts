import dotenv from 'dotenv';
dotenv.config();

import type { Handle, RequestEvent } from '@sveltejs/kit';
import { validateApiKeys, runMaintenance } from '$lib/server';
import { logger } from '$lib/server/logger';
import { apiRateLimiter, authRateLimiter } from '$lib/server/rate-limiter';
import { lucia } from '$lib/server/auth';
import { applySecurityHeaders } from '$lib/server/security-headers';
import { csrfMiddleware } from '$lib/server/csrf';

// Run maintenance on startup
runMaintenance().catch((err) => logger.error({ err }, 'Failed to run initial maintenance'));

declare global {
	var __envValidated: boolean;
}

function getClientIp(event: RequestEvent): string {
	const headers = event.request.headers;
	const forwarded = headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}
	return (
		headers.get('cf-connecting-ip') ||
		headers.get('x-real-ip') ||
		event.getClientAddress() ||
		'unknown'
	);
}

async function validateSession(event: RequestEvent) {
	try {
		if (!event.locals.session) {
			return;
		}

		const session = event.locals.session;
		if (session.expiresAt && Date.now() > session.expiresAt.getTime()) {
			logger.warn(`Expired session detected for user ${session.userId}`);
			await lucia.invalidateSession(session.id);
			event.locals.session = null;
			event.locals.user = null;
		}
	} catch (error) {
		logger.error({ error }, 'Session validation failed');
	}
}

async function applyRateLimiting(event: RequestEvent) {
	const path = event.url.pathname;
	const ip = getClientIp(event);

	if (path.startsWith('/health') || path.startsWith('/static/') || path.startsWith('/favicon')) {
		return;
	}

	if (path.startsWith('/auth/') || path.startsWith('/login') || path.startsWith('/signup')) {
		const result = await authRateLimiter.checkLimit(`auth:${ip}`);
		if (!result.allowed) {
			logger.warn(`Rate limit exceeded for auth endpoint from IP: ${ip}`);
			return new Response('Too many requests. Please try again later.', {
				status: 429,
				headers: {
					'Retry-After': Math.ceil((result.resetTime! - Date.now()) / 1000).toString(),
					'X-RateLimit-Limit': result.limit?.toString() || '10',
					'X-RateLimit-Remaining': '0',
					'X-RateLimit-Reset': Math.ceil((result.resetTime! - Date.now()) / 1000).toString()
				}
			});
		}
	} else if (path.startsWith('/api/')) {
		const result = await apiRateLimiter.checkLimit(`api:${ip}`);
		if (!result.allowed) {
			logger.warn(`Rate limit exceeded for API endpoint from IP: ${ip}`);
			return new Response('Too many requests. Please try again later.', {
				status: 429,
				headers: {
					'Retry-After': Math.ceil((result.resetTime! - Date.now()) / 1000).toString(),
					'X-RateLimit-Limit': result.limit?.toString() || '100',
					'X-RateLimit-Remaining': '0',
					'X-RateLimit-Reset': Math.ceil((result.resetTime! - Date.now()) / 1000).toString()
				}
			});
		}
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	if (!globalThis.__envValidated) {
		try {
			validateApiKeys();
			globalThis.__envValidated = true;
			logger.info('Environment validation completed successfully');
		} catch (error) {
			logger.error({ error }, 'Environment validation failed');
			if (process.env.NODE_ENV === 'production') {
				return new Response('Server configuration error', { status: 500 });
			}
			logger.warn('Running with invalid API keys in development mode');
		}
	}

	const sessionId = event.cookies.get(lucia.sessionCookieName);
	if (!sessionId) {
		event.locals.user = null;
		event.locals.session = null;
	} else {
		const { session, user } = await lucia.validateSession(sessionId);
		if (session && session.fresh) {
			const sessionCookie = lucia.createSessionCookie(session.id);
			event.cookies.set(sessionCookie.name, sessionCookie.value, {
				path: '.',
				...sessionCookie.attributes
			});
		}
		if (!session) {
			const sessionCookie = lucia.createBlankSessionCookie();
			event.cookies.set(sessionCookie.name, sessionCookie.value, {
				path: '.',
				...sessionCookie.attributes
			});
		}
		event.locals.user = user;
		event.locals.session = session;
	}

	const csrfResponse = await csrfMiddleware().handle({ event, resolve });
	if (csrfResponse instanceof Response) {
		return csrfResponse;
	}

	const rateLimitResponse = await applyRateLimiting(event);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	await validateSession(event);
	const response = await resolve(event);
	return applySecurityHeaders(event, response);
};
