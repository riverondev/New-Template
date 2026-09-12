// ─── ActionPlan management and snapshot validation ────────────────────────────

import type { ActionPlan, WorkContext } from "../../../../packages/agent-core/src/workpilot/action-plan"
import { savePlan, getPlan, updatePlanStatus, getAllPlansForIssue } from "./persistence"
import { createLogger } from "../logger"

const log = createLogger("workpilot/plans")

// ─── Snapshot hashing ─────────────────────────────────────────────────────────
// Deterministic hash of the fields that matter for execution.
// If any of these change in Jira after the plan is created → SNAPSHOT_CHANGED.

export function computeSnapshotHash(ctx: WorkContext): string {
  const relevant = {
    status: ctx.status,
    priority: ctx.priority,
    assignee: ctx.assignee ?? null,
    subtaskKeys: ctx.existingSubtasks.map((s) => s.issueKey).sort(),
    relatedKeys: ctx.relatedIssues.map((r) => r.issueKey).sort(),
  }
  // Simple deterministic hash — no crypto dependency needed for MVP
  const str = JSON.stringify(relevant)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

// ─── Plan lifecycle ───────────────────────────────────────────────────────────

export function storePlan(plan: ActionPlan): void {
  // Invalidate any previous pending plans for the same issue
  const existing = getAllPlansForIssue(plan.issueKey)
  for (const old of existing) {
    if (old.planId !== plan.planId && old.status === "pending") {
      updatePlanStatus(old.planId, "invalidated")
      log.info("invalidated stale plan", { planId: old.planId, issueKey: plan.issueKey })
    }
  }
  savePlan(plan)
}

// ─── Validation ───────────────────────────────────────────────────────────────

export type PlanValidationError =
  | "PLAN_NOT_FOUND"
  | "PLAN_EXPIRED"
  | "PLAN_WRONG_VERSION"
  | "PLAN_NOT_PENDING"
  | "SNAPSHOT_CHANGED"

export type PlanValidationResult =
  | { ok: true; plan: ActionPlan }
  | { ok: false; reason: PlanValidationError }

export function validatePlan(
  planId: string,
  version: number,
  currentSnapshotHash: string
): PlanValidationResult {
  const plan = getPlan(planId)

  if (!plan) {
    log.warn("plan not found", { planId })
    return { ok: false, reason: "PLAN_NOT_FOUND" }
  }

  if (plan.status !== "pending") {
    log.warn("plan not pending", { planId, status: plan.status })
    return { ok: false, reason: "PLAN_NOT_PENDING" }
  }

  if (new Date() > new Date(plan.expiresAt)) {
    updatePlanStatus(planId, "expired")
    log.warn("plan expired", { planId, expiresAt: plan.expiresAt })
    return { ok: false, reason: "PLAN_EXPIRED" }
  }

  if (plan.version !== version) {
    log.warn("plan version mismatch", { planId, expected: plan.version, got: version })
    return { ok: false, reason: "PLAN_WRONG_VERSION" }
  }

  if (plan.snapshotHash !== currentSnapshotHash) {
    log.warn("snapshot changed", {
      planId,
      stored: plan.snapshotHash,
      current: currentSnapshotHash,
    })
    return { ok: false, reason: "SNAPSHOT_CHANGED" }
  }

  return { ok: true, plan }
}
