import { validateApiKeys } from '$lib/server';
import { logger } from '$lib/server/logger';
import { RateLimiter } from '$lib/server/rate-limiter';
import { lucia } from '$lib/server/auth';
import { applySecurityHeaders } from '$lib/server/security-headers';
import { csrfMiddleware } from '$lib/server/csrf';

const apiRateLimiter = new RateLimiter({
	maxRequests: 100,
	windowMs: 60000
});

const authRateLimiter = new RateLimiter({
	maxRequests: 10,
	windowMs: 300000
});

declare global {
	var __envValidated: boolean;
}

function getClientIp(event: any): string {
	const headers = event.request.headers;
	const forwarded = headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}
	return headers.get('cf-connecting-ip') ||
		   headers.get('x-real-ip') ||
		   event.getClientAddress() ||
		   'unknown';
}

async function validateSession(event: any) {
	try {
		if (!event.locals.session) {
			return;
		}

		const session = event.locals.session;
		if (session.expiresAt && Date.now() > session.expiresAt) {
			logger.warn(`Expired session detected for user ${session.userId}`);
			await lucia.invalidateSession(session.id);
			event.locals.session = null;
			event.locals.user = null;
		}
	} catch (error) {
		logger.error({ error }, 'Session validation failed');
	}
}

async function applyRateLimiting(event: any) {
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
					'Retry-After': Math.ceil((result.resetTime! - Date.now()) / 1000).toString()
				}
			});
		}
	}
	else if (path.startsWith('/api/')) {
		const result = await apiRateLimiter.checkLimit(`api:${ip}`);
		if (!result.allowed) {
			logger.warn(`Rate limit exceeded for API endpoint from IP: ${ip}`);
			return new Response('Too many requests. Please try again later.', {
				status: 429,
				headers: {
					'Retry-After': Math.ceil((result.resetTime! - Date.now()) / 1000).toString()
				}
			});
		}
	}
}

export const handle = async ({ event, resolve }: { event: any; resolve: any }) => {
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
