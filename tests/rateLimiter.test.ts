import { rateLimiter } from '../src/utils/rateLimiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Clear rate limiter state between tests
    (rateLimiter as any).windows.clear();
  });

  it('should allow requests within limits', () => {
    const result = rateLimiter.canMakeRequest('test');
    expect(result.allowed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should track remaining requests correctly', () => {
    rateLimiter.canMakeRequest('test');
    const remaining = rateLimiter.getRemainingRequests('test');
    
    expect(remaining.minute).toBe(19); // 20 - 1
    expect(remaining.hour).toBe(299);  // 300 - 1
  });

  it('should enforce minute limit', () => {
    // Make 20 requests (the limit)
    for (let i = 0; i < 20; i++) {
      const result = rateLimiter.canMakeRequest('test');
      expect(result.allowed).toBe(true);
    }

    // 21st request should be blocked
    const result = rateLimiter.canMakeRequest('test');
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('20 requests per minute');
  });

  it('should handle different identifiers separately', () => {
    // Make requests for different identifiers
    const result1 = rateLimiter.canMakeRequest('user1');
    const result2 = rateLimiter.canMakeRequest('user2');

    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);

    const remaining1 = rateLimiter.getRemainingRequests('user1');
    const remaining2 = rateLimiter.getRemainingRequests('user2');

    expect(remaining1.minute).toBe(19);
    expect(remaining2.minute).toBe(19);
  });

  it('should return full limits for new identifiers', () => {
    const remaining = rateLimiter.getRemainingRequests('new-user');
    expect(remaining.minute).toBe(20);
    expect(remaining.hour).toBe(300);
  });
});