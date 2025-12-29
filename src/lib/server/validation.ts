import { z } from 'zod';
import { ValidationError } from './error-handler';

export const idSchema = z.string().min(1, 'ID is required');
export const tmdbIdSchema = z.coerce.number().int().positive('TMDB ID must be a positive integer');
export const imdbIdSchema = z.string().regex(/^tt\d{7,8}$/, 'IMDB ID must be in format tt1234567');
export const queryModeSchema = z.enum(['id', 'tmdb', 'imdb']);
export const paginationSchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	sort: z.string().optional(),
	order: z.enum(['asc', 'desc']).optional()
});
export const searchQuerySchema = z
	.string()
	.min(1, 'Search query is required')
	.max(100, 'Search query too long');

export const movieIdentifierSchema = z.object({
	id: z.string().min(1, 'Movie identifier is required'),
	by: queryModeSchema.optional()
});

export const watchlistItemSchema = z.object({
	movieId: z.string().min(1, 'Movie ID is required'),
	userId: z.string().min(1, 'User ID is required')
});

export const watchlistUpdateSchema = z.object({
	items: z.array(watchlistItemSchema)
});

export const playbackProgressSchema = z.object({
	mediaId: z.string().min(1, 'Media ID is required'),
	mediaType: z.enum(['movie', 'tv', 'episode']),
	position: z.number().min(0).max(99999, { message: 'Position too large' }),
	duration: z.number().positive().max(99999, { message: 'Duration too large' }),
	timestamp: z
		.number()
		.positive()
		.default(() => Date.now())
});

export const searchHistorySchema = z.object({
	query: z.string().min(1, 'Search query is required').max(200, 'Search query too long'),
	userId: z.string().min(1, 'User ID is required')
});

export const apiRequestSchema = z.object({
	method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
	path: z.string().min(1, 'Path is required'),
	query: z.record(z.string(), z.string()).optional(),
	body: z.any().optional()
});

export const tvIdentifierSchema = z.object({
	id: z.string().min(1, 'TV identifier is required'),
	tmdbId: tmdbIdSchema.optional()
});

export const tvStatusSchema = z.object({
	tmdbId: tmdbIdSchema,
	userId: z.string().min(1, 'User ID is required'),
	status: z.enum(['watching', 'completed', 'planned', 'dropped', 'on_hold']),
	episodeProgress: z.coerce.number().int().min(0).optional(),
	score: z.coerce.number().int().min(1).max(10).optional()
});

export const episodeProgressSchema = z.object({
	tmdbId: tmdbIdSchema,
	seasonNumber: z.coerce.number().int().positive(),
	episodeNumber: z.coerce.number().int().positive(),
	userId: z.string().min(1, 'User ID is required'),
	position: z.coerce.number().min(0).max(99999),
	duration: z.coerce.number().positive().max(99999)
});

export const streamingRequestSchema = z.object({
	url: z.string().url(),
	quality: z.string().optional(),
	subtitles: z.boolean().optional()
});

export const apiKeySchema = z.object({
	apiKey: z.string().min(32, 'API key must be at least 32 characters').max(64, 'API key too long')
});

export const userRegistrationSchema = z.object({
	email: z.string().email('Invalid email format'),
	password: z.string().min(8, 'Password must be at least 8 characters'),
	username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username too long')
});

export const userLoginSchema = z.object({
	email: z.string().email('Invalid email format'),
	password: z.string().min(1, 'Password is required')
});

export const searchFiltersSchema = z.object({
	query: z.string().optional(),
	genres: z.array(z.string()).optional(),
	year: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
	rating: z.coerce.number().min(0).max(10).optional(),
	sort: z.enum(['popularity', 'rating', 'release_date', 'title']).optional(),
	order: z.enum(['asc', 'desc']).optional()
});

export const paginationWithFiltersSchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20),
	filters: searchFiltersSchema.optional()
});

export const mediaIdentifierSchema = z.object({
	id: z.string().min(1, 'Media ID is required'),
	type: z.enum(['movie', 'tv', 'episode']).optional()
});

export const userPreferencesSchema = z.object({
	theme: z.enum(['light', 'dark', 'system']).optional(),
	language: z.string().min(2).max(10).optional(),
	notifications: z.boolean().optional()
});

export const watchlistOperationSchema = z.object({
	movieId: z.string().min(1, 'Movie ID is required'),
	action: z.enum(['add', 'remove'])
});

export const playbackUpdateSchema = z.object({
	mediaId: z.string().min(1, 'Media ID is required'),
	position: z.number().min(0).max(99999),
	duration: z.number().positive().max(99999),
	timestamp: z
		.number()
		.positive()
		.default(() => Date.now())
});

export const securitySettingsSchema = z.object({
	enable2fa: z.boolean().optional(),
	passwordChange: z
		.object({
			currentPassword: z.string().min(1, 'Current password is required'),
			newPassword: z.string().min(8, 'New password must be at least 8 characters'),
			confirmPassword: z.string().min(1, 'Please confirm your new password')
		})
		.optional()
});

export const searchPeopleSchema = z.object({
	query: searchQuerySchema,
	limit: z.coerce.number().int().positive().max(50).default(10)
});

export const movieByPeopleSchema = z.object({
	people: z.string().min(1, 'People parameter is required'),
	limit: z.coerce.number().int().positive().max(50).default(20)
});

export const searchHistoryItemSchema = z.object({
	id: z.string().min(1, 'History item ID is required'),
	userId: z.string().min(1, 'User ID is required')
});

/**
 * Validate input data against a Zod schema
 * @param schema The Zod schema to validate against
 * @param data The input data to validate
 * @param context Optional context for error messages
 * @throws ValidationError if validation fails
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T {
	try {
		const result = schema.parse(data);
		return result;
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errorDetails = error.flatten();
			const validationError = new ValidationError(`Invalid ${context || 'input'} data`, {
				issues: errorDetails.fieldErrors,
				formErrors: errorDetails.formErrors
			});
			throw validationError;
		} else if (error instanceof Error) {
			const validationError = new ValidationError(
				`Failed to validate ${context || 'input'} data: ${error.message}`
			);
			throw validationError;
		}
		const validationError = new ValidationError(`Failed to validate ${context || 'input'} data`);
		throw validationError;
	}
}

/**
 * Validate and sanitize user input for security
 */
export function validateAndSanitizeInput<T>(
	schema: z.ZodSchema<T>,
	data: unknown,
	context?: string
): T {
	try {
		const parsedData = schema.parse(data);

		const sanitizedData = deepSanitize(parsedData);

		return sanitizedData;
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errorDetails = error.flatten();
			const validationError = new ValidationError(`Invalid ${context || 'input'} data`, {
				issues: errorDetails.fieldErrors,
				formErrors: errorDetails.formErrors
			});
			throw validationError;
		} else if (error instanceof Error) {
			const validationError = new ValidationError(
				`Failed to validate ${context || 'input'} data: ${error.message}`
			);
			throw validationError;
		}
		const validationError = new ValidationError(`Failed to validate ${context || 'input'} data`);
		throw validationError;
	}
}

/**
 * Deep sanitize object properties to prevent XSS
 */
function deepSanitize<T>(obj: T): T {
	if (typeof obj !== 'object' || obj === null) {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => deepSanitize(item)) as any;
	}

	const sanitized: Record<string, any> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === 'string') {
			sanitized[key] = value
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#x27;')
				.replace(/\//g, '&#x2F;');
		} else if (typeof value === 'object' && value !== null) {
			sanitized[key] = deepSanitize(value);
		} else {
			sanitized[key] = value;
		}
	}

	return sanitized as T;
}

/**
 * Validate API key format and extract
 */
export function validateAndExtractApiKey(authHeader: string | null): string {
	if (!authHeader) {
		throw new ValidationError('Authorization header is required');
	}

	if (!authHeader.startsWith('Bearer ')) {
		throw new ValidationError('Authorization header must start with Bearer');
	}

	const apiKey = authHeader.slice(7).trim();
	if (!apiKey || apiKey.length < 32) {
		throw new ValidationError('Invalid API key format');
	}

	return apiKey;
}

/**
 * Validate content type header
 */
export function validateContentType(contentType: string | null, expectedTypes: string[]): void {
	if (!contentType) {
		throw new ValidationError('Content-Type header is required');
	}

	const isValid = expectedTypes.some((expected) =>
		contentType.toLowerCase().includes(expected.toLowerCase())
	);

	if (!isValid) {
		throw new ValidationError(`Content-Type must be one of: ${expectedTypes.join(', ')}`);
	}
}

/**
 * Validate request origin for security
 */
export function validateRequestOrigin(origin: string | null, allowedOrigins: string[]): void {
	if (!origin) {
		throw new ValidationError('Origin header is required');
	}

	try {
		const url = new URL(origin);
		if (!allowedOrigins.includes(url.origin)) {
			throw new ValidationError('Origin not allowed');
		}
	} catch (error) {
		throw new ValidationError('Invalid origin format');
	}
}

/**
 * Validate query parameters
 * @param schema The Zod schema for query parameters
 * @param queryParams The URLSearchParams or record of query parameters
 */
export function validateQueryParams<T>(
	schema: z.ZodSchema<T>,
	queryParams: URLSearchParams | Record<string, string>
): T {
	const params: Record<string, string> = {};

	if (queryParams instanceof URLSearchParams) {
		queryParams.forEach((value, key) => {
			params[key] = value;
		});
	} else {
		Object.assign(params, queryParams);
	}

	return validateInput(schema, params, 'query parameters');
}

/**
 * Validate request body
 * @param schema The Zod schema for the request body
 * @param body The request body data
 */
export function validateRequestBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
	return validateInput(schema, body, 'request body');
}

/**
 * Validate path parameters
 * @param schema The Zod schema for path parameters
 * @param params The path parameters
 */
export function validatePathParams<T>(schema: z.ZodSchema<T>, params: Record<string, string>): T {
	return validateInput(schema, params, 'path parameters');
}

export function isValidTmdbId(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function isValidImdbId(value: unknown): value is string {
	return typeof value === 'string' && /^tt\d{7,8}$/.test(value);
}

export function isValidUUID(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
	);
}
