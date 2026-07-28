import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker } from "../src/circuit.js";
import { RateLimiter } from "../src/rate.js";

describe("CircuitBreaker", () => {
  let cb: CircuitBreaker;
  beforeEach(() => { cb = new CircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 100 }); });

  it("starts closed", () => { expect(cb.state).toBe("closed"); });
  it("opens after failures", () => { cb.recordFailure(); cb.recordFailure(); cb.recordFailure(); expect(cb.state).toBe("open"); });
  it("blocks when open", () => { cb.recordFailure(); cb.recordFailure(); cb.recordFailure(); expect(cb.tryCall()).toBe(false); });

  it("half-open after timeout", async () => {
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    await new Promise(r => setTimeout(r, 150));
    expect(cb.tryCall()).toBe(true); expect(cb.state).toBe("half-open");
  });

  it("closes on success", async () => {
    cb = new CircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 1, halfOpenMaxCalls: 2 });
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    await new Promise(r => setTimeout(r, 20));
    cb.tryCall(); cb.recordSuccess(); cb.tryCall(); cb.recordSuccess();
    expect(cb.state).toBe("closed");
  });

  it("reopens on half-open failure", async () => {
    cb = new CircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 1 });
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    await new Promise(r => setTimeout(r, 20));
    cb.tryCall(); cb.recordFailure();
    expect(cb.state).toBe("open");
  });

  it("reset", () => { cb.recordFailure(); cb.recordFailure(); cb.recordFailure(); cb.reset(); expect(cb.state).toBe("closed"); });
});

describe("RateLimiter", () => {
  it("allows within capacity", () => { const rl = new RateLimiter({ capacity: 10, refillRate: 100, refillIntervalMs: 10 }); expect(rl.tryAcquire(5)).toBe(true); });
  it("blocks when empty", () => { const rl = new RateLimiter({ capacity: 2, refillRate: 0.001, refillIntervalMs: 100 }); rl.tryAcquire(2); expect(rl.tryAcquire(1)).toBe(false); });
  it("refills", async () => { const rl = new RateLimiter({ capacity: 10, refillRate: 50, refillIntervalMs: 10 }); rl.tryAcquire(10); await new Promise(r => setTimeout(r, 60)); expect(rl.available).toBeGreaterThan(1); });
  it("blocking succeeds", async () => { const rl = new RateLimiter({ capacity: 2, refillRate: 100, refillIntervalMs: 10 }); rl.tryAcquire(2); expect(await rl.acquireBlocking(1, 1000)).toBe(true); });
  it("blocking times out", async () => { const rl = new RateLimiter({ capacity: 1, refillRate: 0.001, refillIntervalMs: 100 }); rl.tryAcquire(1); expect(await rl.acquireBlocking(1, 50)).toBe(false); });
  it("reset", () => { const rl = new RateLimiter({ capacity: 5, refillRate: 1, refillIntervalMs: 100 }); rl.tryAcquire(5); rl.reset(); expect(rl.available).toBeCloseTo(5); });
});
