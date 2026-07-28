export type CircuitState = "closed" | "open" | "half-open";
export interface CircuitConfig { failureThreshold: number; recoveryTimeoutMs: number; halfOpenMaxCalls: number; }

const DEFAULTS: CircuitConfig = { failureThreshold: 5, recoveryTimeoutMs: 30000, halfOpenMaxCalls: 3 };

export class CircuitBreaker {
  state: CircuitState = "closed";
  private failures = 0; private successes = 0; private lastFailure = 0; private halfCalls = 0;
  private config: CircuitConfig;

  constructor(config?: Partial<CircuitConfig>) { this.config = { ...DEFAULTS, ...config }; }

  get isOpen(): boolean { return this.state === "open"; }

  recordSuccess(): void {
    if (this.state === "half-open") {
      if (++this.successes >= this.config.halfOpenMaxCalls) { this.state = "closed"; this.failures = 0; this.successes = 0; this.halfCalls = 0; }
    } else if (this.state === "closed") { this.failures = Math.max(0, this.failures - 1); }
  }

  recordFailure(): void {
    this.failures++; this.lastFailure = Date.now();
    if (this.state === "closed" && this.failures >= this.config.failureThreshold) this.state = "open";
    else if (this.state === "half-open") { this.state = "open"; this.successes = 0; }
  }

  tryCall(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() - this.lastFailure >= this.config.recoveryTimeoutMs) { this.state = "half-open"; this.halfCalls = 0; this.successes = 0; }
      else return false;
    }
    if (this.state === "half-open") {
      if (this.halfCalls >= this.config.halfOpenMaxCalls) return false;
      this.halfCalls++; return true;
    }
    return false;
  }

  reset(): void { this.state = "closed"; this.failures = 0; this.successes = 0; this.lastFailure = 0; this.halfCalls = 0; }
}
