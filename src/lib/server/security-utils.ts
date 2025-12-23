import { randomBytes, createHash, createHmac } from 'crypto';
import { logger } from './logger';
import { UnauthorizedError, ForbiddenError } from './error-handler';

/**
 * Security Utilities Module
 *
 * This module provides various security-related utility functions
 * for the application including password hashing, token generation,
 * and security validation functions.
 */

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureToken(length: number = 32): string {
	return randomBytes(length).toString('hex');
}

/**
 * Generate a secure random string with specific character set
 */
export function generateSecureString(length: number = 16, charset: 'alphanumeric' | 'hex' | 'base64' = 'alphanumeric'): string {
	const buffer = randomBytes(length);

	switch (charset) {
		case 'hex':
			return buffer.toString('hex').slice(0, length);
		case 'base64':
			return buffer.toString('base64').slice(0, length);
		case 'alphanumeric':
		default:
			return buffer.toString('base64')
				.replace(/[^a-zA-Z0-9]/g, '')
				.slice(0, length);
	}
}

/**
 * Create a secure hash of data using SHA-256
 */
export function createSecureHash(data: string, salt: string = ''): string {
	return createHash('sha256')
		.update(data + salt)
		.digest('hex');
}

/**
 * Create HMAC signature for data integrity verification
 */
export function createHmacSignature(data: string, secret: string): string {
	return createHmac('sha256', secret)
		.update(data)
		.digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifyHmacSignature(data: string, secret: string, signature: string): boolean {
	const expectedSignature = createHmacSignature(data, secret);
	return timingSafeEqual(expectedSignature, signature);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
	return input
		.replace(/&/g, '&')
		.replace(/</g, '<')
		.replace(/>/g, '>')
		.replace(/"/g, '"')
		.replace(/'/g, '&#39;');
}

/**
 * Validate and sanitize URL input
 */
export function sanitizeUrl(url: string, allowedDomains: string[] = []): string {
	try {
		const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);

		// Check if domain is allowed
		if (allowedDomains.length > 0 && !allowedDomains.includes(parsedUrl.hostname)) {
			throw new Error('Domain not allowed');
		}

		// Validate protocol
		if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
			throw new Error('Invalid protocol');
		}

		return parsedUrl.toString();
	} catch (error) {
		logger.warn(`Invalid URL: ${url}`);
		throw new UnauthorizedError('Invalid URL format');
	}
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
	const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
	return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): { valid: boolean; score: number; feedback: string[] } {
	let score = 0;
	const feedback: string[] = [];

	// Length check
	if (password.length >= 12) {
		score += 2;
	} else if (password.length >= 8) {
		score += 1;
	} else {
		feedback.push('Password should be at least 8 characters long');
	}

	// Character variety checks
	if (/[A-Z]/.test(password)) score += 1;
	else feedback.push('Password should contain uppercase letters');

	if (/[a-z]/.test(password)) score += 1;
	else feedback.push('Password should contain lowercase letters');

	if (/\d/.test(password)) score += 1;
	else feedback.push('Password should contain numbers');

	if (/[^A-Za-z0-9]/.test(password)) score += 1;
	else feedback.push('Password should contain special characters');

	// Common password check
	const commonPasswords = ['password', '123456', 'qwerty', 'letmein', 'welcome'];
	if (commonPasswords.includes(password.toLowerCase())) {
		score = 0;
		feedback.push('Password is too common');
	}

	return {
		valid: score >= 4,
		score,
		feedback
	};
}

/**
 * Generate a secure password hash with salt
 */
export function generatePasswordHash(password: string): { hash: string; salt: string } {
	const salt = generateSecureToken(16);
	const hash = createSecureHash(password + salt);
	return { hash, salt };
}

/**
 * Verify password against stored hash
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
	const computedHash = createSecureHash(password + salt);
	return timingSafeEqual(computedHash, storedHash);
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): { token: string; signature: string } {
	const token = generateSecureToken(32);
	const signature = createHmacSignature(token, process.env.AUTH_SECRET || 'fallback-secret');
	return { token, signature };
}

/**
 * Validate session token
 */
export function validateSessionToken(token: string, signature: string): boolean {
	return verifyHmacSignature(token, process.env.AUTH_SECRET || 'fallback-secret', signature);
}

/**
 * Generate a secure API key
 */
export function generateApiKey(prefix: string = 'mf'): string {
	const randomPart = generateSecureToken(24);
	return `${prefix}_${randomPart}`;
}

/**
 * Validate API key format
 */
export function validateApiKeyFormat(apiKey: string): boolean {
	return /^[a-z]{2,4}_[a-f0-9]{48}$/i.test(apiKey);
}

/**
 * Generate a secure JWT-like token (simplified)
 */
export function generateSecureTokenWithClaims(payload: Record<string, any>, secret: string): string {
	const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
	const encodedHeader = Buffer.from(header).toString('base64').replace(/=+$/, '');
	const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=+$/, '');
	const signature = createHmacSignature(`${encodedHeader}.${encodedPayload}`, secret);
	return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Validate secure token
 */
export function validateSecureToken(token: string, secret: string): boolean {
	try {
		const [header, payload, signature] = token.split('.');
		if (!header || !payload || !signature) return false;

		const expectedSignature = createHmacSignature(`${header}.${payload}`, secret);
		return timingSafeEqual(expectedSignature, signature);
	} catch (error) {
		return false;
	}
}

/**
 * Generate a secure random filename
 */
export function generateSecureFilename(originalName: string, prefix: string = 'file'): string {
	const ext = originalName.split('.').pop() || 'bin';
	const randomPart = generateSecureToken(16);
	return `${prefix}_${Date.now()}_${randomPart}.${ext}`;
}

/**
 * Sanitize file upload metadata
 */
export function sanitizeFileMetadata(metadata: Record<string, any>): Record<string, string> {
	const sanitized: Record<string, string> = {};

	for (const [key, value] of Object.entries(metadata)) {
		if (typeof value === 'string') {
			sanitized[key] = sanitizeInput(value);
		} else if (typeof value === 'number') {
			sanitized[key] = value.toString();
		}
		// Ignore other types for security
	}

	return sanitized;
}

/**
 * Security validation for user input
 */
export function validateUserInput(input: any, maxLength: number = 1000): string {
	if (typeof input !== 'string') {
		throw new ForbiddenError('Input must be a string');
	}

	if (input.length > maxLength) {
		throw new ForbiddenError(`Input exceeds maximum length of ${maxLength} characters`);
	}

	// Check for potentially dangerous patterns
	const dangerousPatterns = [
		/<script\b/i,
		/on\w+=/i,
		/javascript:/i,
		/vbscript:/i,
		/expression\(/i,
		/eval\(/i
	];

	for (const pattern of dangerousPatterns) {
		if (pattern.test(input)) {
			throw new ForbiddenError('Input contains potentially dangerous content');
		}
	}

	return sanitizeInput(input);
}

/**
 * Security utilities export
 */
export const securityUtils = {
	generateSecureToken,
	generateSecureString,
	createSecureHash,
	createHmacSignature,
	verifyHmacSignature,
	timingSafeEqual,
	sanitizeInput,
	sanitizeUrl,
	validateEmail,
	validatePasswordStrength,
	generatePasswordHash,
	verifyPassword,
	generateSessionToken,
	validateSessionToken,
	generateApiKey,
	validateApiKeyFormat,
	generateSecureTokenWithClaims,
	validateSecureToken,
	generateSecureFilename,
	sanitizeFileMetadata,
	validateUserInput
};
