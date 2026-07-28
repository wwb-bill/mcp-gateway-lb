#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { LoadBalancer } from "./loadbalancer.js";
import type { LoadBalancerConfig } from "./loadbalancer.js";
import type { RouteStrategy } from "./router.js";
import type { ServerDef } from "./types.js";

function help(): void {
  console.log(`mcp-gateway-lb — Enterprise MCP Gateway v1.0.0\n\nUsage:\n  mcp-gateway-lb start <config.json>\n  mcp-gateway-lb test [--requests N]\n  mcp-gateway-lb stats <config.json>\n\nConfig format (JSON):\n{\n  "servers": [{"name":"s1","endpoint":"http://host:port","weight":5}],\n  "pool": {"maxTotal":100,"maxPerServer":20},\n  "circuit": {"failureThreshold":5,"recoveryTimeoutMs":30000},\n  "rateLimit": {"capacity":100,"refillRate":10},\n  "strategy": "round-robin"\n}`);
}

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  const cmd = args[0];
  if (!cmd || cmd === "--help" || cmd === "-h") { help(); return; }
  try {
    switch (cmd) {
      case "stats": {
        const config = loadConfig(args[1]);
        if (!config) { console.error("Usage: mcp-gateway-lb stats <config.json>"); process.exit(1); }
        console.log(JSON.stringify(new LoadBalancer(config).pool.stats(), null, 2));
        break;
      }
      case "start": {
        const config = loadConfig(args[1]);
        if (!config) { console.error("Usage: mcp-gateway-lb start <config.json>"); process.exit(1); }
        const lb = new LoadBalancer(config);
        lb.start();
        console.log(`Gateway started: ${config.servers.length} servers (${config.strategy ?? "round-robin"})`);
        process.on("SIGINT", () => { console.log("\nShutting down..."); lb.stop(); process.exit(0); });
        break;
      }
      case "test": {
        const n = parseInt(args[1] ?? "10");
        const servers: ServerDef[] = [{ name: "s1", endpoint: "http://localhost:9001", weight: 3 }, { name: "s2", endpoint: "http://localhost:9002", weight: 1 }];
        const lb = new LoadBalancer({ servers, strategy: "round-robin" });
        let ok = 0, fail = 0;
        console.log(`Running ${n} test requests...`);
        for (let i = 0; i < n; i++) {
          try { await lb.execute(async (s) => `[${s.name}] ok`); ok++; } catch { fail++; }
        }
        console.log(`Results: ${ok} ok, ${fail} failed`);
        console.log(JSON.stringify(lb.pool.stats(), null, 2));
        lb.stop();
        break;
      }
      default: console.error(`Unknown command: ${cmd}`); help(); process.exit(1);
    }
  } catch (err) { console.error("Error:", (err as Error).message); process.exit(1); }
}

function loadConfig(path: string): LoadBalancerConfig | null {
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return { servers: raw.servers, pool: raw.pool, circuit: raw.circuit, rateLimit: raw.rateLimit, strategy: raw.strategy as RouteStrategy | undefined };
  } catch { return null; }
}

main(process.argv);
