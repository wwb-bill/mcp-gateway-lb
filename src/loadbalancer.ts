import type { ServerDef, PoolConfig } from "./types.js";
import type { CircuitConfig } from "./circuit.js";
import type { RateLimitConfig } from "./rate.js";
import type { RouteStrategy } from "./router.js";
import { ConnectionPool } from "./pool.js";
import { HealthChecker } from "./health.js";
import { CircuitBreaker } from "./circuit.js";
import { RateLimiter } from "./rate.js";
import { Router } from "./router.js";

export interface LoadBalancerConfig {
  servers: ServerDef[];
  pool?: Partial<PoolConfig>;
  circuit?: Partial<CircuitConfig>;
  rateLimit?: Partial<RateLimitConfig>;
  strategy?: RouteStrategy;
}

export class LoadBalancer {
  pool: ConnectionPool;
  health: HealthChecker;
  circuit: CircuitBreaker;
  rateLimiter: RateLimiter;
  router: Router;

  constructor(config: LoadBalancerConfig) {
    this.pool = new ConnectionPool(config.servers, config.pool);
    this.health = new HealthChecker(this.pool);
    this.circuit = new CircuitBreaker(config.circuit);
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.router = new Router(config.servers, config.strategy ?? "round-robin");
  }

  async execute<T>(fn: (server: ServerDef) => Promise<T>): Promise<T> {
    if (!this.rateLimiter.tryAcquire()) throw new Error("Rate limit exceeded");
    if (!this.circuit.tryCall()) throw new Error("Circuit breaker is open");
    const server = this.router.select(this.pool);
    if (!server) throw new Error("No healthy servers available");
    const conn = await this.pool.acquire(server.name);
    try {
      const result = await fn(server);
      this.circuit.recordSuccess();
      return result;
    } catch (e) {
      this.circuit.recordFailure();
      throw e;
    } finally { this.pool.release(conn); }
  }

  start(): void { this.health.start(this.router["servers"] as ServerDef[]); }
  stop(): void { this.health.stop(); this.pool.drain(); }
}
