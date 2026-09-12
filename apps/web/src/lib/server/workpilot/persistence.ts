// ─── In-memory persistence store ─────────────────────────────────────────────
// MVP: Map-based store. Replace backing maps with DB calls without changing callers.
// All writes are synchronous — no race conditions within a single Node.js process.

import type { ActionPlan, Execution } from "../../../../packages/agent-core/src/workpilot/action-plan"
import { createLogger } from "../logger"

const log = createLogger("workpilot/persistence")

// ─── Store ────────────────────────────────────────────────────────────────────

const plans = new Map<string, ActionPlan>()
const executions = new Map<string, Execution>()

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
