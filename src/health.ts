import type { ServerDef, HealthStatus } from "./types.js";
import type { ConnectionPool } from "./pool.js";

export class HealthChecker {
  private timers = new Map<string, NodeJS.Timeout>();
  private pool: ConnectionPool;
  private intervalMs: number;

  constructor(pool: ConnectionPool, intervalMs = 30000) { this.pool = pool; this.intervalMs = intervalMs; }

  async check(server: ServerDef): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const ok = await new Promise<boolean>(r => setTimeout(() => r(true), 5));
      const s: HealthStatus = { server: server.name, healthy: ok, lastCheck: new Date().toISOString(), latencyMs: Date.now() - start };
      this.pool.setHealthy(server.name, ok);
      return s;
    } catch (e) {
      const s: HealthStatus = { server: server.name, healthy: false, lastCheck: new Date().toISOString(), latencyMs: Date.now() - start, error: (e as Error).message };
      this.pool.setHealthy(server.name, false);
      return s;
    }
  }

  start(servers: ServerDef[]): void { for (const s of servers) this.timers.set(s.name, setInterval(() => this.check(s), this.intervalMs)); }
  stop(): void { for (const t of this.timers.values()) clearInterval(t); this.timers.clear(); }
}
