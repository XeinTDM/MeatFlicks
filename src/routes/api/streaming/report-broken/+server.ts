import { json, type RequestHandler } from '@sveltejs/kit';
import { reportBrokenLink } from '$lib/server/services/streaming.service';
import { z } from 'zod';
import { validateRequestBody } from '$lib/server/validation';
import { errorHandler } from '$lib/server';

const reportBrokenSchema = z.object({
	providerId: z.string().min(1)
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = validateRequestBody(reportBrokenSchema, await request.json());
		await reportBrokenLink(body.providerId);
		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
