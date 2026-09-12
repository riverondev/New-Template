import { z } from "zod";
import type { ActionPlan } from "agent-core/workpilot/action-plan";
import { loadEnv } from "../env";
const text = z.string().trim().min(1).max(4000);
const key = z.string().regex(/^[A-Z][A-Z0-9_]*-[1-9][0-9]*$/);
const evidenceRef = z.array(text).min(1).max(30);
const actionBase = {
  actionId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  evidenceRefs: evidenceRef, status: z.literal("pending"),
};
const assigneeValue = z.object({ accountId: text, displayName: text.optional() });
const addCommentPayload = z.object({ issueKey: key, body: text }).strict();
const createSubtaskPayload = z.object({
  parentKey: key,
  summary: z.string().trim().min(1).max(255),
  description: text.optional(),
  assignee: text.optional(),
}).strict();
const assignIssuePayload = z.object({ issueKey: key, user: text }).strict();
const setPriorityPayload = z.object({ issueKey: key, priority: text }).strict();
const action = z.discriminatedUnion("type", [
  z.object({ ...actionBase, type: z.literal("add_comment"),
    payload: addCommentPayload,
    after: z.object({ body: text }).strict() }).strict(),
  z.object({ ...actionBase, type: z.literal("create_subtask"),
    payload: createSubtaskPayload,
    after: z.object({ summary: z.string().trim().min(1).max(255), description: text.optional() }).strict() }).strict(),
  z.object({ ...actionBase, type: z.literal("assign_issue"),
    payload: assignIssuePayload,
    before: assigneeValue.nullable().optional(), after: assigneeValue }).strict(),
  z.object({ ...actionBase, type: z.literal("set_priority"),
    payload: setPriorityPayload,
    before: text.optional(), after: text }).strict(),
]);
const evidenceItem = z.object({
  evidenceId: text, sourceType: z.enum(["issue", "comment", "relation", "subtask"]),
  issueKey: key, commentId: text.optional(), relatedIssueKey: key.optional(),
  subtaskKey: key.optional(), excerpt: text, url: z.string().url().optional(),
  flags: z.array(z.literal("potential_prompt_injection")).optional(),
});
const reasoningStatement = z.object({
  statementId: text, text: text, evidenceRefs: z.array(text).min(1).max(30),
});
const missingInfo = z.object({
  missingInfoId: text, text: text, blocking: z.boolean(),
  evidenceRefs: z.array(text).max(30),
});
export const planSchema = z.object({
  planId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), version: z.number().int().positive(),
  issueKey: key, snapshotVersion: text, snapshotHash: text.optional(),
  evidence: z.array(evidenceItem).max(200),
  findings: z.array(reasoningStatement).max(50),
  hypotheses: z.array(reasoningStatement).max(50),
  missingInfo: z.array(missingInfo).max(50),
  actions: z.array(action).min(1).max(10),
  // Legacy P3 channel is accepted for compatibility, but NEVER used as destination.
  slackDraft: z.object({ channel: z.string().optional().default(""), text: z.string().max(4000) }).strict().optional(),
  expiresAt: z.iso.datetime(), createdAt: z.iso.datetime(), status: z.literal("pending"),
}).strict();
export const approvalSchema = z.object({
  planId: z.string().min(1).max(100), version: z.number().int().positive(), dryRun: z.boolean().optional(),
}).strict();
export function validateIssueKey(issueKey: string) {
  key.parse(issueKey);
  if (!issueKey.startsWith(loadEnv().jira.projectKey + "-")) throw new Error("DESTINATION_NOT_ALLOWED");
  return issueKey;
}
export function validateDraft(raw: unknown): ActionPlan {
  const plan = planSchema.parse(raw);
  validateIssueKey(plan.issueKey);
  if (new Set(plan.actions.map(a => a.actionId)).size !== plan.actions.length) throw new Error("DUPLICATE_ACTION_ID");
  for (const action of plan.actions) {
    const payload = action.payload as Record<string, unknown> | undefined;
    if (!payload || typeof payload !== "object") throw new Error("DESTINATION_NOT_ALLOWED");
    const destination = (() => {
      if ("issueKey" in payload) return payload.issueKey;
      if ("parentKey" in payload) return payload.parentKey;
      return undefined;
    })();
    if (destination !== undefined && destination !== plan.issueKey) throw new Error("DESTINATION_NOT_ALLOWED");
    if (action.type === "add_comment" && payload.body === undefined) throw new Error("DESTINATION_NOT_ALLOWED");
    if (action.type === "create_subtask" && payload.summary === undefined) throw new Error("DESTINATION_NOT_ALLOWED");
    if (action.type === "assign_issue" && payload.user === undefined) throw new Error("DESTINATION_NOT_ALLOWED");
    if (action.type === "set_priority" && payload.priority === undefined) throw new Error("DESTINATION_NOT_ALLOWED");
  }
  const expires = Date.parse(plan.expiresAt), created = Date.parse(plan.createdAt);
  if (expires <= Date.now() || created > Date.now() + 60_000 ||
      expires - created > loadEnv().planTtlMinutes * 60_000) throw new Error("PLAN_EXPIRED");
  return plan;
}
