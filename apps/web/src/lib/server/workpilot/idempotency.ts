// ─── Idempotency + concurrency locking ───────────────────────────────────────
// Prevents double-click / double-approve from producing duplicate Jira writes.
// Also prevents concurrent executions of the same plan via a per-planId lock.

import { createLogger } from "../logger"
import { claimRecord, readRecord, releaseRecord, writeRecord } from "./disk"

const log = createLogger("workpilot/idempotency")

// ─── Idempotency store ────────────────────────────────────────────────────────
// Key: `${planId}:${version}:${actionId}`
// Value: the executionId that handled it


export function idempotencyKey(
  planId: string,
  version: number,
  actionId: string
): string {
  return `${planId}:${version}:${actionId}`
}

export function hasExecuted(key: string): boolean {
  return readRecord<string>("idempotency", key) !== undefined
}

export function getExecutionIdForKey(key: string): string | undefined {
  return readRecord<string>("idempotency", key)
}

export function markExecuted(key: string, executionId: string): void {
  log.info("mark executed", { key, executionId })
  writeRecord("idempotency", key, executionId)
}

// ─── Plan-level lock ──────────────────────────────────────────────────────────
// Prevents two concurrent requests from executing the same plan simultaneously.
// Exclusive filesystem claims also prevent two local processes from interleaving.
// An interrupted claim remains blocked for manual inspection; it is not auto-released.


export function acquirePlanLock(planId: string): boolean {
  if (!claimRecord("locks", planId)) {
    log.warn("plan lock already held", { planId })
    return false
  }
  log.debug("plan lock acquired", { planId })
  return true
}

export function releasePlanLock(planId: string): void {
  releaseRecord("locks", planId)
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
