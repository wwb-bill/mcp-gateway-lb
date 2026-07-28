export interface ServerDef { name: string; endpoint: string; weight?: number; maxConnections?: number; healthCheckPath?: string; metadata?: Record<string, string>; }
export interface PoolConfig { maxTotal: number; maxPerServer: number; acquireTimeoutMs: number; idleTimeoutMs: number; healthCheckIntervalMs: number; }
export interface HealthStatus { server: string; healthy: boolean; lastCheck: string; latencyMs: number; error?: string; }
export interface PoolStats { total: number; active: number; idle: number; waiting: number; byServer: Record<string, { active: number; idle: number; healthy: boolean }>; }
