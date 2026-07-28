import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Router } from "../src/router.js";
import { LoadBalancer } from "../src/loadbalancer.js";
import { ConnectionPool } from "../src/pool.js";
import type { ServerDef } from "../src/types.js";

const servers: ServerDef[] = [
  { name: "a", endpoint: "http://a:9001", weight: 5 },
  { name: "b", endpoint: "http://b:9001", weight: 1 },
  { name: "c", endpoint: "http://c:9001", weight: 1 },
];

describe("Router", () => {
  let pool: ConnectionPool;
  beforeEach(() => { pool = new ConnectionPool(servers); });
  afterEach(() => pool.drain());

  it("round-robin cycles", () => {
    const r = new Router(servers);
    expect([r.select(pool)!.name, r.select(pool)!.name, r.select(pool)!.name, r.select(pool)!.name]).toEqual(["a","b","c","a"]);
  });

  it("least-connections picks lowest", () => {
    pool.acquire("a");
    const r = new Router(servers, "least-connections");
    expect(r.select(pool)!.name).not.toBe("a");
  });

  it("weighted favors high-weight", () => {
    const r = new Router(servers, "weighted");
    const counts: Record<string,number> = {};
    for (let i=0;i<70;i++) { const p=r.select(pool); if(p) counts[p.name]=(counts[p.name]??0)+1; }
    expect(counts["a"]).toBeGreaterThan(counts["b"]??0);
  });

  it("returns null when all unhealthy", () => {
    const r = new Router(servers);
    pool.setHealthy("a",false);pool.setHealthy("b",false);pool.setHealthy("c",false);
    expect(r.select(pool)).toBeNull();
  });

  it("setStrategy", () => {
    const r = new Router(servers);
    r.setStrategy("least-connections");
    expect(r.getStrategy()).toBe("least-connections");
  });
});

describe("LoadBalancer", () => {
  it("executes successfully", async () => {
    const lb = new LoadBalancer({ servers: [servers[0]] });
    expect(await lb.execute(async s => `result from ${s.name}`)).toBe("result from a");
    lb.stop();
  });

  it("throws when rate limited", async () => {
    const lb = new LoadBalancer({ servers: [servers[0]], rateLimit: { capacity:1, refillRate:0.001, refillIntervalMs:1000 } });
    await lb.execute(async () => "ok");
    await expect(lb.execute(async () => "nope")).rejects.toThrow("Rate limit");
    lb.stop();
  });

  it("throws when circuit open", async () => {
    const lb = new LoadBalancer({ servers: [servers[0]], circuit: { failureThreshold:0, recoveryTimeoutMs:99999, halfOpenMaxCalls:1 } });
    try { await lb.execute(async () => { throw new Error("fail"); }); } catch {}
    await expect(lb.execute(async () => "blocked")).rejects.toThrow("Circuit breaker");
    lb.stop();
  });

  it("throws when no healthy", async () => {
    const lb = new LoadBalancer({ servers });
    lb.pool.setHealthy("a",false);lb.pool.setHealthy("b",false);lb.pool.setHealthy("c",false);
    await expect(lb.execute(async () => "nope")).rejects.toThrow("No healthy");
    lb.stop();
  });
});
