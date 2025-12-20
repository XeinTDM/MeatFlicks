import { writeFile, mkdir } from 'fs/promises';
import { logger } from '$lib/server/logger';

export class ApiError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
		public readonly code?: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export class RateLimitError extends ApiError {
	constructor(
		message: string,
		public readonly resetTime?: number
	) {
		super(message, 429, 'RATE_LIMIT_EXCEEDED');
		this.name = 'RateLimitError';
	}
}

export class ValidationError extends Error {
	constructor(
		message: string,
		public readonly field?: string
	) {
		super(message);
		this.name = 'ValidationError';
	}
}

export const clone = <T>(value: T): T => {
	if (typeof globalThis.structuredClone === 'function') {
		return globalThis.structuredClone(value);
	}
	return JSON.parse(JSON.stringify(value)) as T;
};

export const toNumber = (value: unknown): number | null => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return null;
	}
	return parsed;
};

export interface SafeParseResult<T> {
	success: boolean;
	data: T | null;
	error?: string;
}

export function safeParseApiResponse<T>(
	response: Record<string, unknown>,
	parseFn: (data: Record<string, unknown>) => T
): SafeParseResult<T> {
	try {
		const parsed = parseFn(response);
		return { success: true, data: parsed };
	} catch (error) {
		return {
			success: false,
			data: null,
			error: error instanceof Error ? error.message : 'Parse error'
		};
	}
}

export async function updateLastRefreshTime() {
	try {
		await mkdir('data', { recursive: true });
		await writeFile('data/last-refresh.txt', Date.now().toString());
	} catch (error) {
		logger.error({ error }, 'Failed to update refresh timestamp');
	}
}
