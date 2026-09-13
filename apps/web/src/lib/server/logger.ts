// ─── Structured logger ───────────────────────────────────────────────────────
// Minimal structured logging. Replace with pino/winston in production.
// All log entries include timestamp, level, module, and optional context.
//
// SECURITY: never pass apiToken, authHeader, or raw credentials as ctx.
// Metrics counters (success/fail/latency) are tracked per module in `_metrics`
// and exposed via getMetrics() for health checks or dashboards.

export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogEntry = {
  ts: string
  level: LogLevel
  module: string
  msg: string
  [key: string]: unknown
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export type ModuleMetrics = {
  success: number
  failure: number
  totalLatencyMs: number
  calls: number
}

const _metrics = new Map<string, ModuleMetrics>()

function getOrCreateMetrics(module: string): ModuleMetrics {
  if (!_metrics.has(module)) {
    _metrics.set(module, { success: 0, failure: 0, totalLatencyMs: 0, calls: 0 })
  }
  return _metrics.get(module)!
}

export function recordMetric(
  module: string,
  outcome: "success" | "failure",
  latencyMs?: number
): void {
  const m = getOrCreateMetrics(module)
  m.calls++
  if (outcome === "success") m.success++
  else m.failure++
  if (latencyMs !== undefined) m.totalLatencyMs += latencyMs
}

export function getMetrics(): Record<string, ModuleMetrics> {
  return Object.fromEntries(_metrics.entries())
}

// For tests: reset all counters
export function resetMetrics(): void {
  _metrics.clear()
}

// ─── Emit ─────────────────────────────────────────────────────────────────────

function emit(level: LogLevel, module: string, msg: string, ctx?: Record<string, unknown>) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    module,
    msg,
    ...ctx,
  }
  const line = JSON.stringify(entry)
  if (level === "error" || level === "warn") {
    console.error(line)
  } else {
    console.log(line)
  }
}

export function createLogger(module: string) {
  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => emit("debug", module, msg, ctx),
    info:  (msg: string, ctx?: Record<string, unknown>) => emit("info",  module, msg, ctx),
    warn:  (msg: string, ctx?: Record<string, unknown>) => emit("warn",  module, msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => emit("error", module, msg, ctx),
  }
}
