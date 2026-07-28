# mcp-gateway-lb

企业级 MCP 网关 — 连接池、熔断器、限流器和健康检查。**第 8 个 M 项目，v0.2.0，24 tests。**

## 模块

- **ConnectionPool** — 多服务器连接池
- **HealthChecker** — 定期健康检查
- **CircuitBreaker** — 熔断器（closed→open→half-open→closed）
- **RateLimiter** — 令牌桶限流器

MIT
