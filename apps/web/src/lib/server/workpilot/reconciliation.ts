// ─── Reconciliation ───────────────────────────────────────────────────────────
// Handles uncertain execution outcomes (e.g. Jira timeout).
// Reads back from Jira to determine if the action was applied — never re-executes.

import type { Action, Execution } from "../../../../packages/agent-core/src/workpilot/action-plan"
import { getExecution, updateExecution } from "./persistence"
import { getIssue, getSubtasks } from "../jira/issues"
import { getIssueComments } from "../jira/comments"
import { getJiraClient } from "../jira/client"
import { createLogger } from "../logger"

const log = createLogger("workpilot/reconciliation")

export async function reconcileExecution(
  executionId: string,
  action: Action
): Promise<Execution> {
  const execution = getExecution(executionId)
  if (!execution) throw new Error(`Execution not found: ${executionId}`)

  if (execution.status !== "uncertain") {
    log.info("reconcile skipped — not uncertain", { executionId, status: execution.status })
    return execution
  }

  log.info("reconciling execution", { executionId, actionType: action.type })

  const client = getJiraClient()
  let resolved = false
  let providerId: string | undefined

  try {
    const p = action.payload as Record<string, string>
    switch (action.type) {
      case "add_comment": {
        const comments = await getIssueComments(p.issueKey, client)
        const match = comments.find(
          (c) =>
            c.body.includes(p.body.slice(0, 60)) &&
            new Date(c.created) >= new Date(execution.startedAt)
        )
        if (match) { resolved = true; providerId = match.id }
        break
      }
      case "create_subtask": {
        const subtasks = await getSubtasks(p.parentKey, client)
        const match = subtasks.find((s) => s.summary === p.summary)
        if (match) { resolved = true; providerId = match.issueKey }
        break
      }
      case "assign_issue": {
        const issue = await getIssue(p.issueKey, client)
        resolved = issue.assignee === p.user
        break
      }
      case "set_priority": {
        const issue = await getIssue(p.issueKey, client)
        resolved = issue.priority.toLowerCase() === p.priority.toLowerCase()
        break
      }
    }
  } catch (err) {
    log.error("reconciliation read failed", { executionId, error: (err as Error).message })
    return execution
  }

  const newStatus = resolved ? "reconciled" : "failed"
  const patch: Partial<Execution> = { status: newStatus, finishedAt: new Date().toISOString(), providerId }
  updateExecution(executionId, patch)
  log.info("reconciliation complete", { executionId, resolved, newStatus })
  return { ...execution, ...patch }
}
