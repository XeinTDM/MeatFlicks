import { validateApiKeys } from '$lib/server';
import { logger } from '$lib/server/logger';

declare global {
	var __envValidated: boolean;
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

	return resolve(event);
};
