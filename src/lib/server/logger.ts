import pino from 'pino';
import { env } from '$lib/config/env';
import { dev } from '$app/environment';

export const logger = pino({
	level: env.LOG_LEVEL,
	transport: dev
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
