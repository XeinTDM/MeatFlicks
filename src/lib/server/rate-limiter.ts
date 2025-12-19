import Bottleneck from 'bottleneck';

interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
}

export class RateLimiter {
	private limiters = new Map<string, Bottleneck>();
	private config: RateLimitConfig;

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
			});
			this.limiters.set(key, limiter);

			limiter.on('error', (error) => {
				console.error(`[RateLimiter] Error in limiter ${key}:`, error);
			});
		}
		return limiter;
	}

	async checkLimit(key: string): Promise<{ allowed: boolean; resetTime?: number }> {
		const limiter = this.getLimiter(key);
		const reservoir = await limiter.currentReservoir();

		if (reservoir !== null && reservoir <= 0) {
			return {
				allowed: false,
				resetTime: Date.now() + this.config.windowMs / 2
			};
		}

		await limiter.incrementReservoir(-1);
		return { allowed: true };
	}

	async schedule<T>(key: string, fn: () => Promise<T>): Promise<T> {
		return this.getLimiter(key).schedule(fn);
	}

	cleanup(): void { }
}

export const tmdbRateLimiter = new RateLimiter({
	maxRequests: 40,
	windowMs: 10000
});
