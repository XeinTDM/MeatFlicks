import pino from 'pino';
import { env } from '$lib/config/env';

// Handle environment detection for both runtime and test environments
const isDev = (() => {
	try {
		// Try to import from SvelteKit environment
		const { dev } = require('$app/environment');
		return dev;
	} catch (error) {
		// Fallback for test environment
		return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
	}
})();

export const logger = pino({
	level: env.LOG_LEVEL,
	transport: isDev
		? {
				target: 'pino-pretty',
				options: {
					colorize: true,
					ignore: 'pid,hostname',
					translateTime: 'SYS:standard'
				}
			}
		: undefined
});

export default logger;
