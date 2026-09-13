import { randomUUID } from "node:crypto";
import { evidenceFromContext, generateActionPlan, parseWorkContext, type WorkContext as AgentContext } from "agent-core/workpilot";
import { proposalSchema } from "agent-core/workpilot/proposal-schema";
import type { Action, WorkContext } from "agent-core/workpilot/action-plan";
import { loadEnv } from "../env";
import { extractText } from "../jira/comments";
import { validateDraft } from "./validation";

export function agentContext(context: WorkContext & { description?: unknown; assigneeAccountId?: string }): AgentContext {
  return parseWorkContext({
    ...context,
    description: extractText(context.description),
    assignee: context.assignee ? { displayName: context.assignee,
      ...(context.assigneeAccountId ? { accountId: context.assigneeAccountId } : {}) } : undefined,
    comments: context.comments.map(c => ({ ...c, author: { displayName: c.author }, createdAt: c.created })),
    relatedIssues: context.relatedIssues.map(r => ({ ...r, relation: r.linkType })),
    coverage: { issue: "complete", comments: "complete", relatedIssues: "complete", subtasks: "complete" },
    // Do not turn a reporter or a display name into authority to assign work.
    assignmentCandidates: [],
  });
}
export function readAgentEvidence(context: WorkContext) {
  const canonical = agentContext(context);
  return { context: canonical, evidence: evidenceFromContext(canonical), snapshotHash: context.snapshotHash };
}
function executionAction(action: Action, issueKey: string): Action {
  switch (action.type) {
    case "add_comment": return { ...action, payload: { issueKey, body: action.after.body } };
    case "create_subtask": return { ...action, payload: { parentKey: issueKey, ...action.after } };
    case "assign_issue": return { ...action, payload: { issueKey, user: action.after.accountId } };
    case "set_priority": return { ...action, payload: { issueKey, priority: action.after } };
  }
}
export function prepareAgentProposal(raw: unknown, context: WorkContext) {
  const input = proposalSchema.parse(raw);
  if (input.issueKey !== context.issueKey) throw new Error("DESTINATION_NOT_ALLOWED");
  if (input.snapshotHash !== context.snapshotHash) throw new Error("SNAPSHOT_CHANGED");
  const now = new Date();
  const generated = generateActionPlan({
    planId: randomUUID(), version: 1, context: agentContext(context),
    reasoning: input.reasoning,
    proposedActions: input.proposedActions.map(a => ({ ...a, status: "pending" })),
    expiresAt: new Date(now.getTime() + loadEnv().planTtlMinutes * 60_000).toISOString(),
  }, { now: () => now });
  // Never send a draft describing actions that policy removed.
  const slackDraft = generated.rejectedActions.length === 0 && generated.plan.actions.length > 0 && input.slackText?.trim()
    ? { channel: "", text: input.slackText } : undefined;
  const plan = validateDraft({
    ...generated.plan, actions: generated.plan.actions.map(a => executionAction(a, context.issueKey)),
    snapshotHash: context.snapshotHash, createdAt: now.toISOString(), status: "pending",
    ...(slackDraft ? { slackDraft } : {}),
  });
  return { plan, rejectedActions: generated.rejectedActions, rejectedReasoning: generated.rejectedReasoning };
}
