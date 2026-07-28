import type { ServerDef } from "./types.js";
import type { ConnectionPool } from "./pool.js";

export type RouteStrategy = "round-robin" | "least-connections" | "weighted";

export class Router {
  private servers: ServerDef[];
  private rrIndex = 0;
  private strategy: RouteStrategy;

  constructor(servers: ServerDef[], strategy: RouteStrategy = "round-robin") {
    this.servers = servers;
    this.strategy = strategy;
  }

  setStrategy(strategy: RouteStrategy): void { this.strategy = strategy; }
  getStrategy(): RouteStrategy { return this.strategy; }

  select(pool: ConnectionPool): ServerDef | null {
    const healthy = this.servers.filter(s => pool.isHealthy(s.name));
    if (healthy.length === 0) return null;

    switch (this.strategy) {
      case "least-connections": {
        const stats = pool.stats();
        return healthy.reduce((best, s) => {
          const cur = stats.byServer[s.name]?.active ?? 999;
          const bestActive = stats.byServer[best.name]?.active ?? 999;
          return cur < bestActive ? s : best;
        });
      }
      case "weighted": {
        const total = healthy.reduce((sum, s) => sum + (s.weight ?? 1), 0);
        let r = Math.random() * total;
        for (const s of healthy) { r -= (s.weight ?? 1); if (r <= 0) return s; }
        return healthy[healthy.length - 1];
      }
      default: {
        const idx = this.rrIndex % healthy.length;
        this.rrIndex++;
        return healthy[idx];
      }
    }
  }
}
