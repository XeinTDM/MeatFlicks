import pino from 'pino';
import { env } from '../config/env';

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

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
