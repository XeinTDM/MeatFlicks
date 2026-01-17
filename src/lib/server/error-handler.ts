import { logger } from './logger';
import type { RequestEvent } from '@sveltejs/kit';

export class AppError extends Error {
	constructor(
		public message: string,
		public status: number = 500,
		public code?: string,
		public details?: unknown,
		public context?: Record<string, unknown>
	) {
		super(message);
		this.name = 'AppError';
	}
}

export class ValidationError extends AppError {
	constructor(
		public message: string,
		public details?: unknown,
		public context?: Record<string, unknown>
	) {
		super(message, 400, 'VALIDATION_ERROR', details, context);
		this.name = 'ValidationError';
	}
}

export class NotFoundError extends AppError {
	constructor(
		public message: string = 'Resource not found',
		public context?: Record<string, unknown>
	) {
		super(message, 404, 'NOT_FOUND', undefined, context);
		this.name = 'NotFoundError';
	}
}

export class UnauthorizedError extends AppError {
	constructor(
		public message: string = 'Unauthorized',
		public context?: Record<string, unknown>
	) {
		super(message, 401, 'UNAUTHORIZED', undefined, context);
		this.name = 'UnauthorizedError';
	}
}

export class ForbiddenError extends AppError {
	constructor(
		public message: string = 'Forbidden',
		public context?: Record<string, unknown>
	) {
		super(message, 403, 'FORBIDDEN', undefined, context);
		this.name = 'ForbiddenError';
	}
}

export class RateLimitError extends AppError {
	constructor(
		public message: string = 'Too many requests',
		public retryAfter?: number,
		public context?: Record<string, unknown>
	) {
		super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter }, context);
		this.name = 'RateLimitError';
	}
}

export class ServiceUnavailableError extends AppError {
	constructor(
		public message: string = 'Service unavailable',
		public context?: Record<string, unknown>
	) {
		super(message, 503, 'SERVICE_UNAVAILABLE', undefined, context);
		this.name = 'ServiceUnavailableError';
	}
}

export class ConflictError extends AppError {
	constructor(
		public message: string = 'Conflict',
		public context?: Record<string, unknown>
	) {
		super(message, 409, 'CONFLICT', undefined, context);
		this.name = 'ConflictError';
	}
}

export function handleError(
	error: unknown,
	event?: RequestEvent
): { status: number; body: Record<string, string | number | unknown> } {
	if (error instanceof AppError) {
		logger.error({
			error: error.message,
			status: error.status,
			code: error.code,
			details: error.details,
			path: event?.route?.id
		});

		const body: Record<string, string | number | unknown> = {
			error: error.message,
			code: error.code
		};

		if (error.details !== undefined) {
			body.details = error.details;
		}

		return {
			status: error.status,
			body
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
		ForbiddenError,
		RateLimitError,
		ServiceUnavailableError,
		ConflictError
	};
}

export const errorHandler = createErrorHandler();
