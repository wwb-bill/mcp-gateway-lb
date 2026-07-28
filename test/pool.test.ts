import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConnectionPool } from "../src/pool.js";
import { HealthChecker } from "../src/health.js";
import type { ServerDef } from "../src/types.js";

const servers: ServerDef[] = [{ name: "primary", endpoint: "http://localhost:9001" }, { name: "secondary", endpoint: "http://localhost:9002" }];

describe("ConnectionPool", () => {
  let pool: ConnectionPool;
  beforeEach(() => { pool = new ConnectionPool(servers); });
  afterEach(() => pool.drain());

  it("acquires", async () => { const c = await pool.acquire(); expect(c.server).toBeTruthy(); expect(pool.totalActive).toBe(1); });
  it("releases", async () => { const c = await pool.acquire(); pool.release(c); expect(pool.totalActive).toBe(0); });
  it("reuses idle", async () => { const c1 = await pool.acquire(); pool.release(c1); const c2 = await pool.acquire(); expect(c2.id).toBe(c1.id); });
  it("respects maxTotal", async () => { const sp = new ConnectionPool(servers, { maxTotal: 2, acquireTimeoutMs: 50 }); await sp.acquire(); await sp.acquire(); await expect(sp.acquire()).rejects.toThrow(); sp.drain(); });
  it("skips unhealthy", async () => { pool.setHealthy("primary", false); expect((await pool.acquire()).server).toBe("secondary"); });
  it("throws all unhealthy", async () => { pool.setHealthy("primary", false); pool.setHealthy("secondary", false); await expect(pool.acquire()).rejects.toThrow("No healthy"); });
  it("drains waiters", async () => { const sp = new ConnectionPool(servers, { maxTotal: 1, acquireTimeoutMs: 5000 }); await sp.acquire(); const p = sp.acquire(); sp.drain(); await expect(p).rejects.toThrow("draining"); });
  it("stats", () => { const s = pool.stats(); expect(s.total).toBe(0); expect(s.byServer["primary"].healthy).toBe(true); });
});

describe("HealthChecker", () => {
  it("checks health", async () => { const p = new ConnectionPool(servers); const hc = new HealthChecker(p); const r = await hc.check(servers[0]); expect(r.healthy).toBe(true); p.drain(); });
  it("marks unhealthy on error", async () => { const p = new ConnectionPool([{ name: "bad", endpoint: "http://x" }]); const hc = new HealthChecker(p); (hc as any).ping = async () => { throw new Error("refused"); }; const r = await hc.check({ name: "bad", endpoint: "x" }); expect(r.healthy).toBe(false); p.drain(); });
});
