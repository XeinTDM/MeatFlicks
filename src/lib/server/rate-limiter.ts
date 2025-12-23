import Bottleneck from 'bottleneck';
import { logger } from './logger';

interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
	penaltyMs?: number;
}

interface RateLimitResult {
	allowed: boolean;
	resetTime?: number;
	remaining?: number;
	limit?: number;
}

export class RateLimiter {
	private limiters = new Map<string, Bottleneck>();
	private config: RateLimitConfig;
	private penaltyCache = new Map<string, { until: number; count: number }>();

	constructor(config: RateLimitConfig) {
		this.config = config;
	}

	private getLimiter(key: string): Bottleneck {
		let limiter = this.limiters.get(key);
		if (!limiter) {
			limiter = new Bottleneck({
				id: key,
				reservoir: this.config.maxRequests,
				reservoirRefreshInterval: this.config.windowMs,
				reservoirRefreshAmount: this.config.maxRequests,
				maxConcurrent: 5,
				penalty: this.config.penaltyMs || 5000,
				minTime: 10
			});
			this.limiters.set(key, limiter);

			limiter.on('error', (error) => {
				logger.error(`[RateLimiter] Error in limiter ${key}:`, error);
			});

			limiter.on('dropped', (info) => {
				logger.warn(`[RateLimiter] Request dropped for ${key}: ${JSON.stringify(info)}`);
			});
		}
		return limiter;
	}

	async checkLimit(key: string): Promise<RateLimitResult> {
		const limiter = this.getLimiter(key);

		// Check if key is in penalty box
		const penalty = this.penaltyCache.get(key);
		if (penalty && Date.now() < penalty.until) {
			return {
				allowed: false,
				resetTime: penalty.until,
				remaining: 0,
				limit: this.config.maxRequests
			};
		}

		const reservoir = (await limiter.currentReservoir()) ?? 0;

		if (reservoir <= 0) {
			// Apply penalty for exceeding rate limit
			this.applyPenalty(key);

			return {
				allowed: false,
				resetTime: Date.now() + this.config.windowMs / 2,
				remaining: 0,
				limit: this.config.maxRequests
			};
		}

		await limiter.incrementReservoir(-1);
		return {
			allowed: true,
			remaining: reservoir,
			limit: this.config.maxRequests
		};
	}

	async schedule<T>(key: string, fn: () => Promise<T>): Promise<T> {
		return this.getLimiter(key).schedule(fn);
	}

	private applyPenalty(key: string): void {
		const penalty = this.penaltyCache.get(key) || { until: 0, count: 0 };

		// Exponential backoff for repeated violations
		const penaltyDuration = Math.min(
			15 * 60 * 1000, // Max 15 minutes
			Math.pow(2, penalty.count) * 30 * 1000 // 30s * 2^count
		);

		penalty.until = Date.now() + penaltyDuration;
		penalty.count++;

		this.penaltyCache.set(key, penalty);

		// Clean up old penalties
		setTimeout(() => {
			if (this.penaltyCache.get(key)?.until === penalty.until) {
				this.penaltyCache.delete(key);
			}
		}, penaltyDuration);
	}

	cleanup(): void {
		// Clean up old limiters
		const now = Date.now();
		for (const [key, penalty] of this.penaltyCache) {
			if (now > penalty.until) {
				this.penaltyCache.delete(key);
			}
		}
	}

	getStats(): { activeLimiters: number; penaltyCount: number } {
		return {
			activeLimiters: this.limiters.size,
			penaltyCount: this.penaltyCache.size
		};
	}
}

export const tmdbRateLimiter = new RateLimiter({
	maxRequests: 40,
	windowMs: 10000
});

// Enhanced rate limiters for different endpoint types
export const apiRateLimiter = new RateLimiter({
	maxRequests: 100,
	windowMs: 60000,
	penaltyMs: 10000
});

export const authRateLimiter = new RateLimiter({
	maxRequests: 10,
	windowMs: 300000,
	penaltyMs: 300000
});

export const searchRateLimiter = new RateLimiter({
	maxRequests: 30,
	windowMs: 60000,
	penaltyMs: 30000
});

export const streamingRateLimiter = new RateLimiter({
	maxRequests: 20,
	windowMs: 60000,
	penaltyMs: 60000
});

/**
 * Create a rate limiter with specific configuration
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
	return new RateLimiter(config);
}

/**
 * Get rate limit information for monitoring
 */
export function getRateLimitInfo(limiter: RateLimiter): Promise<{
	activeLimiters: number;
	penaltyCount: number;
}> {
	return Promise.resolve(limiter.getStats());
}
