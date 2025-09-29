interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
}

interface RateLimitEntry {
	count: number;
	resetTime: number;
}

export class RateLimiter {
	private requests = new Map<string, RateLimitEntry>();
	private config: RateLimitConfig;

	constructor(config: RateLimitConfig) {
		this.config = config;
	}

	async checkLimit(key: string): Promise<{ allowed: boolean; resetTime?: number }> {
		const now = Date.now();
		let entry = this.requests.get(key);

		if (!entry || now >= entry.resetTime) {
			entry = {
				count: 0,
				resetTime: now + this.config.windowMs
			};
			this.requests.set(key, entry);
		}

		if (entry.count >= this.config.maxRequests) {
			return { allowed: false, resetTime: entry.resetTime };
		}

		entry.count += 1;
		return { allowed: true };
	}

	cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.requests) {
			if (now > entry.resetTime) {
				this.requests.delete(key);
			}
		}
	}
}

export const tmdbRateLimiter = new RateLimiter({
	maxRequests: 30,
	windowMs: 1000
});

setInterval(() => tmdbRateLimiter.cleanup(), 60 * 1000);
