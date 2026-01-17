import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from '../../src/routes/api/streaming/report-broken/+server';
import * as streamingService from '$lib/server/services/streaming.service';
import { reportBrokenRateLimiter } from '$lib/server/rate-limiter';
import * as csrfModule from '$lib/server/csrf';
import type { RequestEvent } from '@sveltejs/kit';

const mockValidateCsrf = vi.spyOn(csrfModule, 'validateCsrfForApi');
const mockReportBrokenLink = vi.spyOn(streamingService, 'reportBrokenLink');
const mockRateLimit = vi.spyOn(reportBrokenRateLimiter, 'checkLimit');

const buildRequest = (payload: Record<string, unknown>) =>
	new Request('https://example.com/api/streaming/report-broken', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-csrf-token': 'csrf-token'
		},
		body: JSON.stringify(payload)
	});

const buildEvent = (request: Request, locals: App.Locals): RequestEvent => {
	const event = {
		request,
		locals,
		cookies: {
			get: () =>
				JSON.stringify({ token: 'csrf-token', signature: 'sig', expires: Date.now() + 1000 })
		},
		url: new URL('https://example.com/api/streaming/report-broken'),
		params: {},
		platform: undefined,
		fetch: () => Promise.resolve(new Response(null)),
		route: { id: '/api/streaming/report-broken' },
		setHeaders: () => {}
	} as unknown as RequestEvent;
	return event;
};

describe('POST /api/streaming/report-broken', () => {
	beforeEach(() => {
		mockValidateCsrf.mockReset();
		mockValidateCsrf.mockResolvedValue(undefined);
		mockReportBrokenLink.mockResolvedValue(undefined);
		mockRateLimit.mockResolvedValue({ allowed: true });
	});

	const unauthenticatedLocals: App.Locals = { user: null, session: null };
	const authenticatedLocals: App.Locals = {
		user: { id: 'user1', username: 'tester', role: 'USER' },
		session: null
	};

	it('rejects unauthenticated users', async () => {
		const request = buildRequest({ providerId: 'p1' });
		const response = await POST(buildEvent(request, unauthenticatedLocals));

		expect(response.status).toBe(401);
		expect(mockReportBrokenLink).not.toHaveBeenCalled();
		expect(mockValidateCsrf).toHaveBeenCalled();
	});

	it('enforces rate limiting', async () => {
		mockRateLimit.mockResolvedValueOnce({
			allowed: false,
			resetTime: Date.now() + 30000
		});

		const request = buildRequest({ providerId: 'p1' });
		const response = await POST(buildEvent(request, authenticatedLocals));

		expect(response.status).toBe(429);
		expect(mockReportBrokenLink).not.toHaveBeenCalled();
		expect(mockRateLimit).toHaveBeenCalledWith('report-broken:user1:p1');
		expect(mockValidateCsrf).toHaveBeenCalled();
	});

	it('records a broken provider when authenticated and under limit', async () => {
		const request = buildRequest({ providerId: '  p1  ' });
		const response = await POST(buildEvent(request, authenticatedLocals));

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.success).toBe(true);
		expect(mockReportBrokenLink).toHaveBeenCalledWith('p1');
		expect(mockValidateCsrf).toHaveBeenCalled();
		expect(mockRateLimit).toHaveBeenCalledWith('report-broken:user1:p1');
	});
});
