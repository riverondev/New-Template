// ─── Idempotency + concurrency locking ───────────────────────────────────────
// Prevents double-click / double-approve from producing duplicate Jira writes.
// Also prevents concurrent executions of the same plan via a per-planId lock.

import { createLogger } from "../logger"

const log = createLogger("workpilot/idempotency")

// ─── Idempotency store ────────────────────────────────────────────────────────
// Key: `${planId}:${version}:${actionId}`
// Value: the executionId that handled it

const executed = new Map<string, string>()

export function idempotencyKey(
  planId: string,
  version: number,
  actionId: string
): string {
  return `${planId}:${version}:${actionId}`
}

export function hasExecuted(key: string): boolean {
  return executed.has(key)
}

export function getExecutionIdForKey(key: string): string | undefined {
  return executed.get(key)
}

export function markExecuted(key: string, executionId: string): void {
  log.info("mark executed", { key, executionId })
  executed.set(key, executionId)
}

// ─── Plan-level lock ──────────────────────────────────────────────────────────
// Prevents two concurrent requests from executing the same plan simultaneously.
// Node.js is single-threaded but async — two awaited calls can interleave.

const planLocks = new Set<string>()

export function acquirePlanLock(planId: string): boolean {
  if (planLocks.has(planId)) {
    log.warn("plan lock already held", { planId })
    return false
  }
  planLocks.add(planId)
  log.debug("plan lock acquired", { planId })
  return true
}

export function releasePlanLock(planId: string): void {
  planLocks.delete(planId)
  log.debug("plan lock released", { planId })
}

// ─── Helper: run with lock ────────────────────────────────────────────────────

export async function withPlanLock<T>(
  planId: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!acquirePlanLock(planId)) {
    throw new Error(`Plan ${planId} is already being executed`)
  }
  try {
    return await fn()
  } finally {
    releasePlanLock(planId)
  }
}
