interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  windowMs: number; // Duration of rate limit window in milliseconds
  maxRequests: number; // Max number of requests allowed in window
}

/**
 * Basic in-memory sliding rate limiter for public submission endpoints.
 * Easily swappable with Redis/Upstash in high-scale multi-region deployment.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = { windowMs: 60 * 1000, maxRequests: 10 }
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetTime) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetTime: now + options.windowMs,
    };
    memoryStore.set(key, newRecord);
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetTime: newRecord.resetTime,
    };
  }

  if (record.count >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: options.maxRequests - record.count,
    resetTime: record.resetTime,
  };
}
