interface RateLimitWindow {
  requests: number[];
}

class RateLimiter {
  private windows: Map<string, RateLimitWindow> = new Map();
  private readonly minuteLimit = 20;
  private readonly hourLimit = 300;
  private readonly minuteWindow = 60 * 1000; // 1 minute in ms
  private readonly hourWindow = 60 * 60 * 1000; // 1 hour in ms

  private cleanOldRequests(requests: number[], windowMs: number): number[] {
    const now = Date.now();
    return requests.filter(timestamp => now - timestamp < windowMs);
  }

  canMakeRequest(identifier: string = 'default'): { allowed: boolean; error?: string } {
    const now = Date.now();
    
    if (!this.windows.has(identifier)) {
      this.windows.set(identifier, { requests: [] });
    }

    const window = this.windows.get(identifier)!;
    
    // Clean old requests
    window.requests = this.cleanOldRequests(window.requests, this.hourWindow);
    
    const recentMinuteRequests = this.cleanOldRequests(window.requests, this.minuteWindow);
    const recentHourRequests = window.requests;

    // Check minute limit
    if (recentMinuteRequests.length >= this.minuteLimit) {
      return {
        allowed: false,
        error: `Rate limit exceeded: ${this.minuteLimit} requests per minute`
      };
    }

    // Check hour limit
    if (recentHourRequests.length >= this.hourLimit) {
      return {
        allowed: false,
        error: `Rate limit exceeded: ${this.hourLimit} requests per hour`
      };
    }

    // Record the request
    window.requests.push(now);
    return { allowed: true };
  }

  getRemainingRequests(identifier: string = 'default'): { minute: number; hour: number } {
    if (!this.windows.has(identifier)) {
      return { minute: this.minuteLimit, hour: this.hourLimit };
    }

    const window = this.windows.get(identifier)!;
    const now = Date.now();
    
    const recentMinuteRequests = this.cleanOldRequests(window.requests, this.minuteWindow);
    const recentHourRequests = this.cleanOldRequests(window.requests, this.hourWindow);

    return {
      minute: Math.max(0, this.minuteLimit - recentMinuteRequests.length),
      hour: Math.max(0, this.hourLimit - recentHourRequests.length)
    };
  }
}

export const rateLimiter = new RateLimiter();