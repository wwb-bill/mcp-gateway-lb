# mcp-gateway-lb

Enterprise-grade MCP Gateway — connection pooling, circuit breaking, rate limiting, and health checks. **8th M project, v0.2.0, 24 tests.**

```bash
npm install mcp-gateway-lb
```

## Modules

- **ConnectionPool** — Multi-server pool, idle reuse, health-aware, wait queue, graceful drain
- **HealthChecker** — Periodic health pings, healthy/unhealthy state management
- **CircuitBreaker** — closed→open→half-open→closed state machine, configurable thresholds
- **RateLimiter** — Token bucket with async acquire/refill

## Usage

```ts
import { ConnectionPool, CircuitBreaker, RateLimiter } from "mcp-gateway-lb";

const pool = new ConnectionPool([
  { name: "primary", endpoint: "http://localhost:9001" },
  { name: "secondary", endpoint: "http://localhost:9002" },
]);
const conn = await pool.acquire();
pool.release(conn);
```

MIT — 🚧 In progress (R2/4, 50%)
