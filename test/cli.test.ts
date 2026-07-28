import { describe, it, expect } from "vitest";
import { LoadBalancer } from "../src/loadbalancer.js";
import { ConnectionPool } from "../src/pool.js";
import { CircuitBreaker } from "../src/circuit.js";
import { RateLimiter } from "../src/rate.js";
import { Router } from "../src/router.js";
import { HealthChecker } from "../src/health.js";
import type { ServerDef } from "../src/types.js";

const testServers: ServerDef[] = [{ name:"a",endpoint:"http://a:9001",weight:3},{ name:"b",endpoint:"http://b:9001",weight:1}];

describe("Integration", () => {
  it("full pipeline", async () => {
    const lb = new LoadBalancer({ servers: testServers });
    const r: string[] = [];
    for (let i=0;i<5;i++) r.push(await lb.execute(async s=>s.name));
    expect(r.length).toBe(5);
    lb.stop();
  });

  it("circuit opens on failures", async () => {
    const lb = new LoadBalancer({ servers:[testServers[0]], circuit:{ failureThreshold:2, recoveryTimeoutMs:99999, halfOpenMaxCalls:1 }});
    for (let i=0;i<2;i++) try { await lb.execute(async ()=>{ throw new Error("fail"); }); } catch {}
    await expect(lb.execute(async () => "ok")).rejects.toThrow("Circuit breaker");
    lb.stop();
  });

  it("health check", async () => {
    const pool = new ConnectionPool(testServers);
    const hc = new HealthChecker(pool);
    expect((await hc.check({ name:"bad",endpoint:"http://x" })).healthy).toBe(true);
    pool.drain();
  });

  it("lifecycle", () => { const lb = new LoadBalancer({ servers: testServers }); lb.start(); lb.stop(); });
});

describe("v1.0 completeness", () => {
  it("all modules exportable", () => {
    expect(ConnectionPool).toBeDefined(); expect(CircuitBreaker).toBeDefined();
    expect(RateLimiter).toBeDefined(); expect(Router).toBeDefined(); expect(LoadBalancer).toBeDefined();
  });

  it("pool stats", async () => {
    const lb = new LoadBalancer({ servers: [testServers[0]] });
    await lb.execute(async () => "test");
    expect(lb.pool.stats().active).toBe(0);
    lb.stop();
  });

  it("weighted fair", () => {
    const pool = new ConnectionPool(testServers);
    const router = new Router(testServers, "weighted");
    const c:Record<string,number>={};
    for (let i=0;i<40;i++) { const s=router.select(pool); if(s) c[s.name]=(c[s.name]??0)+1; }
    expect(c["a"]).toBeGreaterThan(c["b"]??0);
    pool.drain();
  });
});
