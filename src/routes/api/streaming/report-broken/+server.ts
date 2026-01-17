import { json, type RequestHandler } from '@sveltejs/kit';
import { reportBrokenLink } from '$lib/server/services/streaming.service';
import { z } from 'zod';
import { validateRequestBody } from '$lib/server/validation';
import { errorHandler, RateLimitError, UnauthorizedError, ValidationError } from '$lib/server';
import { validateCsrfForApi } from '$lib/server/csrf';
import { reportBrokenRateLimiter } from '$lib/server/rate-limiter';

const reportBrokenSchema = z.object({
	providerId: z.string().min(1)
});

export const POST: RequestHandler = async (event) => {
	try {
		await validateCsrfForApi(event);

		const { request, locals } = event;
		const user = locals.user;
		if (!user) {
			throw new UnauthorizedError('User must be authenticated to report broken providers');
		}

		const body = validateRequestBody(reportBrokenSchema, await request.json());
		const providerId = body.providerId.trim();
		if (!providerId) {
			throw new ValidationError('providerId must contain non-whitespace characters');
		}

		const rateLimitKey = `report-broken:${user.id}:${providerId}`;
		const rateLimitResult = await reportBrokenRateLimiter.checkLimit(rateLimitKey);
		if (!rateLimitResult.allowed) {
			const retryAfterSeconds = rateLimitResult.resetTime
				? Math.max(1, Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000))
				: undefined;
			throw new RateLimitError('Rate limit exceeded for provider reports', retryAfterSeconds);
		}

		await reportBrokenLink(providerId);
		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
