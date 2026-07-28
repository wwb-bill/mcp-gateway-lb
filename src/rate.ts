export interface RateLimitConfig { capacity: number; refillRate: number; refillIntervalMs: number; }

const DEFAULTS: RateLimitConfig = { capacity: 100, refillRate: 10, refillIntervalMs: 100 };

export class RateLimiter {
  private tokens: number; private lastRefill: number; private config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = { ...DEFAULTS, ...config }; this.tokens = this.config.capacity; this.lastRefill = Date.now();
  }

  get available(): number { this._refill(); return this.tokens; }

  tryAcquire(count = 1): boolean { this._refill(); if (this.tokens >= count) { this.tokens -= count; return true; } return false; }

  acquireBlocking(count = 1, timeoutMs = 5000): Promise<boolean> {
    if (this.tryAcquire(count)) return Promise.resolve(true);
    return new Promise(resolve => {
      const start = Date.now();
      const check = () => {
        if (this.tryAcquire(count)) { resolve(true); return; }
        if (Date.now() - start >= timeoutMs) { resolve(false); return; }
        setTimeout(check, this.config.refillIntervalMs);
      };
      setTimeout(check, this.config.refillIntervalMs);
    });
  }

  private _refill(): void {
    const now = Date.now(); const elapsed = now - this.lastRefill;
    const add = (elapsed / 1000) * this.config.refillRate;
    if (add >= 1 / this.config.refillRate) { this.tokens = Math.min(this.config.capacity, this.tokens + add); this.lastRefill = now; }
  }

  reset(): void { this.tokens = this.config.capacity; this.lastRefill = Date.now(); }
}
