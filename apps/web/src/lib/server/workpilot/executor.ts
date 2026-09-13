// P4 integration of the P3 executor. No model or frontend code invokes provider writes.
import { randomUUID } from "node:crypto";
import type { Action, ActionPlan, ActionResult, ApprovalRequest, ApprovalResult, Execution } from "agent-core/workpilot/action-plan";
import { getIssue } from "../jira/issues";
import { getIssueComments } from "../jira/comments";
import { getJiraClient, JiraError } from "../jira/client";
import { loadEnv } from "../env";
import { getPlan, getExecutionsForPlan, saveExecution, updateExecution, updatePlanStatus } from "./persistence";
import { withPlanLock, markExecuted, idempotencyKey } from "./idempotency";
import { validatePlan } from "./plans";
import { validateDraft } from "./validation";
import { readContext } from "./context";
import { readRecord, writeRecord } from "./disk";
import { deliverSlack, getDelivery, slackSummary } from "../slack/delivery";

export type IntegrationResult = ApprovalResult & { dryRun?: boolean };
const adf = (text: string) => ({ type: "doc", version: 1,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function write(action: Action, issueKey: string): Promise<string | undefined> {
  const client = getJiraClient();
  switch (action.type) {
    case "add_comment":
      return (await client.post<{ id: string }>(`/issue/${issueKey}/comment`, { body: adf(action.after.body) })).id;
    case "create_subtask":
      return (await client.post<{ key: string }>("/issue", { fields: {
        project: { key: loadEnv().jira.projectKey }, parent: { key: issueKey }, summary: action.after.summary,
        ...(action.after.description ? { description: adf(action.after.description) } : {}),
        // Installation-specific Jira issue type ID; never an invented/localized name.
        issuetype: { id: process.env.WORKPILOT_DEMO === "true" ? "fixture-subtask" : process.env.JIRA_SUBTASK_ISSUE_TYPE_ID },
      } })).key;
    case "assign_issue":
      await client.put(`/issue/${issueKey}/assignee`, { accountId: action.after.accountId }); return issueKey;
    case "set_priority":
      await client.put(`/issue/${issueKey}`, { fields: { priority: { name: action.after } } }); return issueKey;
  }
}

export async function verifyWrite(action: Action, issueKey: string, providerId?: string): Promise<boolean> {
  switch (action.type) {
    case "add_comment":
      return !!providerId && (await getIssueComments(issueKey)).some(c => c.id === providerId && c.body === action.after.body);
    case "create_subtask": {
      if (!providerId) return false;
      const issue = await getIssue(providerId);
      return issue.issueKey === providerId && issue.parentKey === issueKey && issue.summary === action.after.summary;
    }
    case "assign_issue": return (await getIssue(issueKey)).assigneeAccountId === action.after.accountId;
    case "set_priority": return (await getIssue(issueKey)).priority === action.after;
    default: return false;
  }
}

async function executeAction(action: Action, plan: ActionPlan): Promise<ActionResult> {
  const prior = getExecutionsForPlan(plan.planId).find(e =>
    e.actionId === action.actionId && e.planVersion === plan.version && e.provider === "jira");
  if (prior) return {
    actionId: action.actionId,
    status: prior.status === "succeeded" || prior.status === "reconciled" ? "succeeded" : "reconciling",
    providerId: prior.providerId,
    retryable: false,
    error: prior.error,
  } as ActionResult;
  const executionId = randomUUID();
  const execution: Execution = {
    executionId, planId: plan.planId, planVersion: plan.version, issueKey: plan.issueKey,
    actionId: action.actionId, startedAt: new Date().toISOString(), provider: "jira",
    status: "started", retryable: false, dryRun: false,
  };
  // Persist intent BEFORE provider call. Interruption never authorizes a replay.
  saveExecution(execution);
  let providerId: string | undefined;
  try {
    providerId = await write(action, plan.issueKey);
    updateExecution(executionId, { providerId });
    if (!(await verifyWrite(action, plan.issueKey, providerId))) throw new Error("READBACK_MISMATCH");
    updateExecution(executionId, { status: "succeeded", finishedAt: new Date().toISOString(), providerId });
    markExecuted(idempotencyKey(plan.planId, plan.version, action.actionId), executionId);
    return { actionId: action.actionId, status: "succeeded", providerId };
  } catch (error) {
    const definite = error instanceof JiraError && error.status >= 400 && error.status < 500;
    const message = definite ? "Jira rejected the action." : "Jira result unconfirmed; inspect the provider before any new plan.";
    updateExecution(executionId, { status: definite ? "failed" : "uncertain", providerId,
      error: message, errorCode: definite ? error.code : "UNCONFIRMED", finishedAt: new Date().toISOString(), retryable: false });
    return { actionId: action.actionId, status: definite ? "failed" : "reconciling", providerId, error: message, retryable: false } as ActionResult;
  }
}

export function getApprovalResult(plan: ActionPlan): IntegrationResult | undefined {
  const result = readRecord<IntegrationResult>("results", plan.planId + ":" + plan.version);
  if (result) return { ...result, ...slackSummary(getDelivery(plan.planId, plan.version)) };
  // Recovery after process interruption: expose durable per-action intent/results.
  const executions = getExecutionsForPlan(plan.planId);
  if (!executions.length) return undefined;
  return { planId: plan.planId, issueKey: plan.issueKey, slackStatus: "pending",
    actions: plan.actions.map(a => {
      const e = executions.find(e => e.actionId === a.actionId && e.planVersion === plan.version);
      return {
        actionId: a.actionId,
        status: e?.status === "succeeded" || e?.status === "reconciled" ? "succeeded" :
          e?.status === "failed" ? "failed" : e ? "reconciling" : "pending",
        providerId: e?.providerId,
        error: e?.error,
        retryable: false,
      } as ActionResult;
    }) };
}

export async function executeApproval(request: ApprovalRequest): Promise<IntegrationResult> {
  const raw = getPlan(request.planId);
  if (!raw) throw new Error("PLAN_NOT_FOUND");
  return withPlanLock("issue:" + raw.issueKey, () => withPlanLock(raw.planId, async () => {
    const plan = getPlan(raw.planId)!;
    if (plan.version !== request.version) throw new Error("PLAN_WRONG_VERSION");
    const prior = getApprovalResult(plan);
    if (prior) return prior as IntegrationResult; // duplicate approval only reads, never sends Slack again
    const current = await readContext(plan.issueKey);
    const valid = validatePlan(plan.planId, request.version, current.snapshotHash);
    if (!valid.ok) throw new Error(valid.reason);
    validateDraft(plan);
    if (!plan.actions.length) throw new Error("PLAN_NO_ACTIONS");
    if (request.dryRun) return { planId: plan.planId, issueKey: plan.issueKey, dryRun: true,
      actions: plan.actions.map(a => ({ actionId: a.actionId, status: "skipped" as const })), slackStatus: "skipped" } as IntegrationResult;
    if (!loadEnv().writesEnabled) throw new Error("WRITES_DISABLED");
    if (plan.actions.some(a => a.type === "create_subtask") &&
      process.env.WORKPILOT_DEMO !== "true" && !process.env.JIRA_SUBTASK_ISSUE_TYPE_ID) throw new Error("SUBTASK_TYPE_NOT_CONFIGURED");
    updatePlanStatus(plan.planId, "approved");
    const actions: ActionResult[] = [];
    for (const action of plan.actions) {
      if (actions.some(a => a.status !== "succeeded")) {
        actions.push({ actionId: action.actionId, status: "skipped", error: "Stopped after earlier failure.", retryable: false } as ActionResult);
      } else actions.push(await executeAction(action, plan));
    }
    const result: IntegrationResult = { planId: plan.planId, issueKey: plan.issueKey, actions, slackStatus: "skipped" };
    writeRecord("results", plan.planId + ":" + plan.version, result);
    updatePlanStatus(plan.planId, "executed");
    if (actions.every(a => a.status === "succeeded")) {
      const delivery = await deliverSlack(plan);
      Object.assign(result, slackSummary(delivery));
      writeRecord("results", plan.planId + ":" + plan.version, result);
    }
    return result;
  }));
}
