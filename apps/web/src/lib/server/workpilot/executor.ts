// ─── Server Executor ──────────────────────────────────────────────────────────
// The ONLY path through which Jira writes happen.
// Flow: Approve → validate → lock → per-action: idempotency → write → read-back → record
// Agent NEVER calls this directly. Only POST /api/workpilot/approve does.

import type {
  Action,
  ActionPlan,
  ActionPayloadMap,
  ActionResult,
  ApprovalRequest,
  ApprovalResult,
  Execution,
} from "../../../../packages/agent-core/src/workpilot/action-plan"
import { getIssue, getSubtasks } from "../jira/issues"
import { getIssueComments } from "../jira/comments"
import { getRelatedIssues } from "../jira/relations"
import { getJiraClient } from "../jira/client"
import { computeSnapshotHash, validatePlan } from "./plans"
import { updatePlanStatus, saveExecution, updateExecution } from "./persistence"
import {
  idempotencyKey,
  hasExecuted,
  markExecuted,
  withPlanLock,
} from "./idempotency"
import { reconcileExecution } from "./reconciliation"
import { loadEnv } from "../env"
import { createLogger } from "../logger"

const log = createLogger("workpilot/executor")

// ─── Jira write helpers ───────────────────────────────────────────────────────

async function writeToJira(action: Action, dryRun: boolean): Promise<string | undefined> {
  if (dryRun) {
    log.info("dry-run: skipping write", { actionId: action.actionId, type: action.type })
    return `dry-run:${action.actionId}`
  }

  const client = getJiraClient()

  switch (action.type) {
    case "add_comment": {
      const p = action.payload as ActionPayloadMap["add_comment"]
      const res = await client.post<{ id: string }>(
        `/issue/${p.issueKey}/comment`,
        { body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: p.body }] }] } }
      )
      return res.id
    }

    case "create_subtask": {
      const p = action.payload as ActionPayloadMap["create_subtask"]
      const env = loadEnv()
      const res = await client.post<{ key: string }>("/issue", {
        fields: {
          project: { key: env.jira.projectKey },
          parent: { key: p.parentKey },
          summary: p.summary,
          description: p.description
            ? { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: p.description }] }] }
            : undefined,
          assignee: p.assignee ? { name: p.assignee } : undefined,
          issuetype: { name: "Subtask" },
        },
      })
      return res.key
    }

    case "assign_issue": {
      const p = action.payload as ActionPayloadMap["assign_issue"]
      await client.put(`/issue/${p.issueKey}/assignee`, { name: p.user })
      return undefined
    }

    case "set_priority": {
      const p = action.payload as ActionPayloadMap["set_priority"]
      await client.put(`/issue/${p.issueKey}`, {
        fields: { priority: { name: p.priority } },
      })
      return undefined
    }
  }
}

// ─── Read-back verification ───────────────────────────────────────────────────

async function verifyWrite(action: Action, providerId?: string): Promise<boolean> {
  const client = getJiraClient()

  switch (action.type) {
    case "add_comment": {
      if (!providerId) return false
      const p = action.payload as ActionPayloadMap["add_comment"]
      const comments = await getIssueComments(p.issueKey, client)
      return comments.some((c) => c.id === providerId)
    }

    case "create_subtask": {
      if (!providerId) return false
      const issue = await getIssue(providerId, client)
      return !!issue.issueKey
    }

    case "assign_issue": {
      const p = action.payload as ActionPayloadMap["assign_issue"]
      const issue = await getIssue(p.issueKey, client)
      return issue.assignee === p.user
    }

    case "set_priority": {
      const p = action.payload as ActionPayloadMap["set_priority"]
      const issue = await getIssue(p.issueKey, client)
      return issue.priority.toLowerCase() === p.priority.toLowerCase()
    }
  }
}

// ─── Execute a single action ──────────────────────────────────────────────────

async function executeAction(
  action: Action,
  plan: ActionPlan,
  dryRun: boolean
): Promise<ActionResult> {
  const key = idempotencyKey(plan.planId, plan.version, action.actionId)

  // Idempotency check
  if (hasExecuted(key)) {
    log.info("action already executed — skipping", { key })
    return { actionId: action.actionId, status: "skipped" }
  }

  const executionId = `${plan.planId}:${action.actionId}:${Date.now()}`
  const execution: Execution = {
    executionId,
    planId: plan.planId,
    planVersion: plan.version,
    issueKey: plan.issueKey,
    actionId: action.actionId,
    startedAt: new Date().toISOString(),
    status: "started",
    provider: "jira",
    retryable: false,
    dryRun,
  }
  saveExecution(execution)

  let providerId: string | undefined

  try {
    providerId = await writeToJira(action, dryRun)

    // Read-back verification
    const verified = dryRun || (await verifyWrite(action, providerId))

    if (!verified) {
      updateExecution(executionId, {
        status: "uncertain",
        finishedAt: new Date().toISOString(),
        providerId,
        retryable: true,
      })
      log.warn("write unverified — marking uncertain", { executionId })

      // Attempt reconciliation immediately
      const reconciled = await reconcileExecution(executionId, action)
      if (reconciled.status === "reconciled") {
        markExecuted(key, executionId)
        return { actionId: action.actionId, status: "succeeded", providerId: reconciled.providerId }
      }

      return { actionId: action.actionId, status: "failed", error: "Write unverified" }
    }

    updateExecution(executionId, {
      status: "succeeded",
      finishedAt: new Date().toISOString(),
      providerId,
    })
    markExecuted(key, executionId)

    log.info("action succeeded", { executionId, actionId: action.actionId, providerId })
    return { actionId: action.actionId, status: "succeeded", providerId }
  } catch (err) {
    const error = (err as Error).message
    const retryable = (err as { retryable?: boolean }).retryable ?? false

    updateExecution(executionId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      error,
      retryable,
    })

    log.error("action failed", { executionId, actionId: action.actionId, error })
    return { actionId: action.actionId, status: "failed", error }
  }
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function executeApproval(
  request: ApprovalRequest
): Promise<ApprovalResult> {
  const { planId, version } = request
  const env = loadEnv()
  const dryRun = request.dryRun === true || !env.writesEnabled

  if (dryRun) {
    log.info("executor running in dry-run mode", { planId })
  }

  return withPlanLock(planId, async () => {
    const client = getJiraClient()

    // 1. Get plan first (without snapshot check) to know the issueKey
    const { getPlan } = await import("./persistence")
    const rawPlan = getPlan(planId)
    if (!rawPlan) {
      log.warn("plan not found for approval", { planId })
      throw new Error("PLAN_NOT_FOUND")
    }

    // Fetch current Jira state using the real issueKey
    const [issueFields, subtasks, relatedIssues, comments] = await Promise.all([
      getIssue(rawPlan.issueKey, client),
      getSubtasks(rawPlan.issueKey, client),
      getRelatedIssues(rawPlan.issueKey, client),
      getIssueComments(rawPlan.issueKey, client),
    ])

    const currentContext = {
      issueKey: rawPlan.issueKey,
      summary: issueFields.summary,
      status: issueFields.status,
      priority: issueFields.priority,
      assignee: issueFields.assignee,
      comments,
      relatedIssues,
      existingSubtasks: subtasks,
      snapshotVersion: issueFields.updatedAt,
      snapshotHash: "",
      fetchedAt: new Date().toISOString(),
    }
    const currentSnapshotHash = computeSnapshotHash(currentContext)

    // 2. Validate plan (existence, expiry, version, snapshot)
    const validation = validatePlan(planId, version, currentSnapshotHash)
    if (!validation.ok) {
      log.warn("plan validation failed", { planId, reason: validation.reason })
      throw new Error(validation.reason)
    }

    const plan = validation.plan
    updatePlanStatus(planId, "approved")

    // 3. Execute each action sequentially
    const actionResults: ActionResult[] = []

    for (const action of plan.actions) {
      const result = await executeAction(action, plan, dryRun)
      actionResults.push(result)
    }

    // 4. Coordinate Slack — only after all Jira actions verified
    // Slack is implemented by P4. We call their interface here.
    let slackStatus: ApprovalResult["slackStatus"] = "skipped"
    let slackProviderId: string | undefined

    const allSucceeded = actionResults.every(
      (r) => r.status === "succeeded" || r.status === "skipped"
    )

    if (allSucceeded && plan.slackDraft.channel && plan.slackDraft.text) {
      try {
        const { sendSlackNotification } = await import("../slack/notifications")
        const slackResult = await sendSlackNotification(
          plan.slackDraft.channel,
          plan.slackDraft.text,
          planId
        )
        slackStatus = slackResult.status
        slackProviderId = slackResult.providerId
      } catch (err) {
        log.error("slack notification failed", {
          planId,
          error: (err as Error).message,
        })
        slackStatus = "failed"
      }
    }

    updatePlanStatus(planId, "executed")

    log.info("execution complete", {
      planId,
      issueKey: plan.issueKey,
      actionsTotal: plan.actions.length,
      succeeded: actionResults.filter((r) => r.status === "succeeded").length,
      failed: actionResults.filter((r) => r.status === "failed").length,
      slackStatus,
    })

    return {
      planId,
      issueKey: plan.issueKey,
      actions: actionResults,
      slackStatus,
      slackProviderId,
    }
  })
}
