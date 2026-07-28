import type { ServerDef, PoolConfig, PoolStats } from "./types.js";

const DEFAULTS: PoolConfig = { maxTotal: 100, maxPerServer: 20, acquireTimeoutMs: 5000, idleTimeoutMs: 60000, healthCheckIntervalMs: 30000 };

interface Conn { id: number; server: string; acquiredAt: number; releasedAt: number; }

class ServerState { active = new Set<Conn>(); idle: Conn[] = []; healthy = true; }

export class ConnectionPool {
  private servers = new Map<string, ServerState>();
  private config: PoolConfig;
  private nextId = 0;
  private queue: Array<{ resolve: (c: Conn) => void; reject: (e: Error) => void; timeout: NodeJS.Timeout }> = [];

  constructor(defs: ServerDef[], config?: Partial<PoolConfig>) {
    this.config = { ...DEFAULTS, ...config };
    for (const d of defs) this.servers.set(d.name, new ServerState());
  }

  get totalActive(): number { let n = 0; for (const s of this.servers.values()) n += s.active.size; return n; }
  get totalIdle(): number { let n = 0; for (const s of this.servers.values()) n += s.idle.length; return n; }

  async acquire(server?: string): Promise<Conn> {
    const targets = (server ? [server] : [...this.servers.keys()]).filter(s => this.servers.get(s)?.healthy);
    if (targets.length === 0) throw new Error("No healthy servers");

    for (const s of targets) {
      const st = this.servers.get(s)!;
      if (st.idle.length > 0) { const c = st.idle.pop()!; c.acquiredAt = Date.now(); st.active.add(c); return c; }
    }

    if (this.totalActive < this.config.maxTotal) {
      for (const s of targets) {
        const st = this.servers.get(s)!;
        if (st.active.size < this.config.maxPerServer) {
          const c: Conn = { id: ++this.nextId, server: s, acquiredAt: Date.now(), releasedAt: 0 };
          st.active.add(c); return c;
        }
      }
    }

    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.queue = this.queue.filter(w => w.resolve !== resolve); reject(new Error("timeout")); }, this.config.acquireTimeoutMs);
      this.queue.push({ resolve, reject, timeout: t });
    });
  }

  release(c: Conn): void {
    const st = this.servers.get(c.server);
    if (!st || !st.active.has(c)) return;
    st.active.delete(c); c.releasedAt = Date.now();
    const w = this.queue.shift();
    if (w) { clearTimeout(w.timeout); c.acquiredAt = Date.now(); st.active.add(c); w.resolve(c); return; }
    st.idle.push(c);
    while (st.idle.length > this.config.maxPerServer) st.idle.shift();
  }

  drain(): void { for (const w of this.queue) { clearTimeout(w.timeout); w.reject(new Error("draining")); } this.queue = []; for (const s of this.servers.values()) { s.active.clear(); s.idle = []; } }
  setHealthy(s: string, h: boolean): void { const st = this.servers.get(s); if (st) st.healthy = h; }
  isHealthy(s: string): boolean { return this.servers.get(s)?.healthy ?? false; }

  stats(): PoolStats {
    const bs: Record<string, { active: number; idle: number; healthy: boolean }> = {};
    for (const [n, s] of this.servers) bs[n] = { active: s.active.size, idle: s.idle.length, healthy: s.healthy };
    return { total: this.totalActive + this.totalIdle, active: this.totalActive, idle: this.totalIdle, waiting: this.queue.length, byServer: bs };
  }
}
