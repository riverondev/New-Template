// Durable per-record store. Atomic file replacement preserves records on restart.
// Read/modify/write workflows use the executor's persistent locks.

import type { ActionPlan, Execution } from "agent-core/workpilot/action-plan"
import { createLogger } from "../logger"
import { DiskMap } from "./disk"

const log = createLogger("workpilot/persistence")

// ─── Store ────────────────────────────────────────────────────────────────────

const plans = new DiskMap<ActionPlan>("plans")
const executions = new DiskMap<Execution>("executions")

// ─── ActionPlan CRUD ──────────────────────────────────────────────────────────

export function savePlan(plan: ActionPlan): void {
  log.info("save plan", { planId: plan.planId, version: plan.version, issueKey: plan.issueKey })
  plans.set(plan.planId, plan)
}

export function getPlan(planId: string): ActionPlan | undefined {
  return plans.get(planId)
}

export function updatePlanStatus(
  planId: string,
  status: ActionPlan["status"]
): void {
  const plan = plans.get(planId)
  if (!plan) return
  plans.set(planId, { ...plan, status })
  log.info("plan status updated", { planId, status })
}

export function getAllPlansForIssue(issueKey: string): ActionPlan[] {
  return Array.from(plans.values()).filter((p) => p.issueKey === issueKey)
}

// ─── Execution CRUD ───────────────────────────────────────────────────────────

export function saveExecution(execution: Execution): void {
  log.info("save execution", {
    executionId: execution.executionId,
    actionId: execution.actionId,
    status: execution.status,
  })
  executions.set(execution.executionId, execution)
}

export function getExecution(executionId: string): Execution | undefined {
  return executions.get(executionId)
}

export function updateExecution(
  executionId: string,
  patch: Partial<Execution>
): void {
  const ex = executions.get(executionId)
  if (!ex) return
  executions.set(executionId, { ...ex, ...patch })
}

export function getExecutionsForPlan(planId: string): Execution[] {
  return Array.from(executions.values()).filter((e) => e.planId === planId)
}

export function getExecutionByActionId(
  planId: string,
  actionId: string
): Execution | undefined {
  return Array.from(executions.values()).find(
    (e) => e.planId === planId && e.actionId === actionId
  )
}
