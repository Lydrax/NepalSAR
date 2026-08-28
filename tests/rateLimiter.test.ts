import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '../src/lib/services/rateLimiter';

describe('Server Rate Limiter', () => {
  it('allows requests within limit and blocks when threshold is exceeded', () => {
    const testKey = 'test_ip_' + Math.random().toString(36).substring(2, 9);
    const options = { windowMs: 1000, maxRequests: 3 };

    // Request 1
    const res1 = checkRateLimit(testKey, options);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);

    // Request 2
    const res2 = checkRateLimit(testKey, options);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    // Request 3
    const res3 = checkRateLimit(testKey, options);
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);

    // Request 4 (Limit exceeded)
    const res4 = checkRateLimit(testKey, options);
    expect(res4.allowed).toBe(false);
    expect(res4.remaining).toBe(0);
  });
});
