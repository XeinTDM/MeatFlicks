import { logger } from './logger';
import type { RequestEvent } from '@sveltejs/kit';

export class AppError extends Error {
	constructor(
		public message: string,
		public status: number = 500,
		public code?: string,
		public details?: any
	) {
		super(message);
		this.name = 'AppError';
	}
}

export class ValidationError extends AppError {
	constructor(public message: string, public details?: any) {
		super(message, 400, 'VALIDATION_ERROR', details);
		this.name = 'ValidationError';
	}
}

export class NotFoundError extends AppError {
	constructor(public message: string = 'Resource not found') {
		super(message, 404, 'NOT_FOUND');
		this.name = 'NotFoundError';
	}
}

export class UnauthorizedError extends AppError {
	constructor(public message: string = 'Unauthorized') {
		super(message, 401, 'UNAUTHORIZED');
		this.name = 'UnauthorizedError';
	}
}

export class ForbiddenError extends AppError {
	constructor(public message: string = 'Forbidden') {
		super(message, 403, 'FORBIDDEN');
		this.name = 'ForbiddenError';
	}
}

export function handleError(error: unknown, event?: RequestEvent): { status: number; body: any } {
	if (error instanceof AppError) {
		logger.error({
			error: error.message,
			status: error.status,
			code: error.code,
			details: error.details,
			path: event?.route?.id
		});

		return {
			status: error.status,
			body: {
				error: error.message,
				code: error.code,
				...(error.details && { details: error.details })
			}
		};
	}

	if (error instanceof Error) {
		logger.error({
			error: error.message,
			stack: error.stack,
			path: event?.route?.id
		});

		return {
			status: 500,
			body: {
				error: 'Internal server error',
				code: 'INTERNAL_ERROR'
			}
		};
	}

	logger.error({
		error: 'Unknown error',
		originalError: error,
		path: event?.route?.id
	});

	return {
		status: 500,
		body: {
			error: 'Internal server error',
			code: 'INTERNAL_ERROR'
		}
	};
}

export function createErrorHandler() {
	return {
		handleError,
		AppError,
		ValidationError,
		NotFoundError,
		UnauthorizedError,
		ForbiddenError
	};
}

export const errorHandler = createErrorHandler();
