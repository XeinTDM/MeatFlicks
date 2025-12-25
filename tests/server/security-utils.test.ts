import { describe, expect, it } from 'vitest';
import { securityUtils } from '$lib/server/security-utils';

describe('Security Utilities', () => {
	describe('Token Generation', () => {
		it('should generate secure tokens', () => {
			const token1 = securityUtils.generateSecureToken(32);
			const token2 = securityUtils.generateSecureToken(32);

			expect(token1).toHaveLength(64);
			expect(token2).toHaveLength(64);
			expect(token1).not.toBe(token2);
		});

		it('should generate secure strings with different character sets', () => {
			const alphanumeric = securityUtils.generateSecureString(16, 'alphanumeric');
			const hex = securityUtils.generateSecureString(16, 'hex');
			const base64 = securityUtils.generateSecureString(16, 'base64');

			expect(alphanumeric).toMatch(/^[a-zA-Z0-9]+$/);
			expect(hex).toMatch(/^[a-f0-9]+$/);
			expect(base64).toMatch(/^[a-zA-Z0-9+/=]+$/);
		});
	});

	describe('Hashing and Signatures', () => {
		it('should create and verify HMAC signatures', () => {
			const data = 'test-data';
			const secret = 'test-secret';
			const signature = securityUtils.createHmacSignature(data, secret);

			expect(securityUtils.verifyHmacSignature(data, secret, signature)).toBe(true);
			expect(securityUtils.verifyHmacSignature(data, 'wrong-secret', signature)).toBe(false);
		});

		it('should perform timing-safe string comparison', () => {
			expect(securityUtils.timingSafeEqual('test', 'test')).toBe(true);
			expect(securityUtils.timingSafeEqual('test', 'wrong')).toBe(false);
		});

		it('should create secure hashes', () => {
			const hash1 = securityUtils.createSecureHash('test-data');
			const hash2 = securityUtils.createSecureHash('test-data');

			expect(hash1).toBe(hash2);
			expect(hash1).toHaveLength(64);
		});
	});

	describe('Input Sanitization', () => {
		it('should sanitize input to prevent XSS', () => {
			const dangerousInput = '<script>alert("xss")</script>';
			const sanitized = securityUtils.sanitizeInput(dangerousInput);
			expect(sanitized).toBe('<script>alert("xss")</script>');
		});

		it('should sanitize multiple dangerous characters', () => {
			const input = 'Test & <test> with "quotes" and \'apostrophes\'';
			const sanitized = securityUtils.sanitizeInput(input);
			expect(sanitized).toBe('Test & <test> with "quotes" and &#39;apostrophes&#39;');
		});
	});

	describe('Validation Functions', () => {
		it('should validate email format', () => {
			expect(securityUtils.validateEmail('test@example.com')).toBe(true);
			expect(securityUtils.validateEmail('invalid-email')).toBe(false);
			expect(securityUtils.validateEmail('user@domain.co.uk')).toBe(true);
		});

		it('should validate password strength', () => {
			const weakPassword = securityUtils.validatePasswordStrength('password');
			expect(weakPassword.valid).toBe(false);
			expect(weakPassword.score).toBeLessThan(4);

			const strongPassword = securityUtils.validatePasswordStrength('StrongP@ssw0rd123!');
			expect(strongPassword.valid).toBe(true);
			expect(strongPassword.score).toBeGreaterThanOrEqual(4);
		});

		it('should provide feedback for weak passwords', () => {
			const result = securityUtils.validatePasswordStrength('short');
			expect(result.feedback).toContain('Password should be at least 8 characters long');
		});
	});

	describe('Password Security', () => {
		it('should generate and verify password hashes', () => {
			const { hash, salt } = securityUtils.generatePasswordHash('test-password');
			expect(securityUtils.verifyPassword('test-password', hash, salt)).toBe(true);
			expect(securityUtils.verifyPassword('wrong-password', hash, salt)).toBe(false);
		});

		it('should generate different hashes for same password with different salts', () => {
			const { hash: hash1, salt: salt1 } = securityUtils.generatePasswordHash('password');
			const { hash: hash2, salt: salt2 } = securityUtils.generatePasswordHash('password');

			expect(hash1).not.toBe(hash2);
			expect(salt1).not.toBe(salt2);
		});
	});

	describe('Session and API Security', () => {
		it('should generate and validate session tokens', () => {
			const { token, signature } = securityUtils.generateSessionToken();
			expect(securityUtils.validateSessionToken(token, signature)).toBe(true);
			expect(securityUtils.validateSessionToken(token, 'wrong-signature')).toBe(false);
		});

		it('should generate API keys with proper format', () => {
			const apiKey = securityUtils.generateApiKey('mf');
			expect(apiKey).toMatch(/^mf_[a-f0-9]{48}$/);
		});

		it('should validate API key format', () => {
			expect(
				securityUtils.validateApiKeyFormat('mf_123456789012345678901234567890123456789012345678')
			).toBe(true);
			expect(securityUtils.validateApiKeyFormat('invalid-key')).toBe(false);
		});
	});

	describe('Token Utilities', () => {
		it('should generate and validate secure tokens with claims', () => {
			const payload = { userId: '123', role: 'admin' };
			const token = securityUtils.generateSecureTokenWithClaims(payload, 'test-secret');
			expect(securityUtils.validateSecureToken(token, 'test-secret')).toBe(true);
			expect(securityUtils.validateSecureToken(token, 'wrong-secret')).toBe(false);
		});

		it('should detect invalid token format', () => {
			expect(securityUtils.validateSecureToken('invalid-token', 'secret')).toBe(false);
			expect(securityUtils.validateSecureToken('header.payload', 'secret')).toBe(false);
		});
	});

	describe('File Security', () => {
		it('should generate secure filenames', () => {
			const filename = securityUtils.generateSecureFilename('test-file.txt');
			expect(filename).toMatch(/^file_\d+_[a-f0-9]{32}\.txt$/);
		});

		it('should sanitize file metadata', () => {
			const metadata = {
				name: '<script>test</script>',
				description: 'Test & special chars',
				invalid: { nested: 'value' }
			};

			const sanitized = securityUtils.sanitizeFileMetadata(metadata);
			expect(sanitized.name).toBe('<script>test</script>');
			expect(sanitized.description).toBe('Test & special chars');
			expect(sanitized.invalid).toBeUndefined();
		});
	});

	describe('User Input Validation', () => {
		it('should validate user input and throw for invalid types', () => {
			expect(() => securityUtils.validateUserInput(123)).toThrow('Input must be a string');
			expect(() => securityUtils.validateUserInput('valid')).not.toThrow();
		});

		it('should reject input with dangerous patterns', () => {
			expect(() => securityUtils.validateUserInput('<script>alert("xss")</script>')).toThrow(
				'Input contains potentially dangerous content'
			);
			expect(() => securityUtils.validateUserInput('onload=alert("xss")')).toThrow(
				'Input contains potentially dangerous content'
			);
		});

		it('should sanitize valid input', () => {
			const result = securityUtils.validateUserInput('Test <input>');
			expect(result).toBe('Test <input>');
		});
	});
});
