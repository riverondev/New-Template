import { z } from "zod";
import type { ActionPlan } from "agent-core/workpilot/action-plan";
import { loadEnv } from "../env";
const text = z.string().trim().min(1).max(4000);
const key = z.string().regex(/^[A-Z][A-Z0-9_]*-[1-9][0-9]*$/);
const actionBase = {
  actionId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  before: z.unknown().optional(), after: z.unknown().optional(),
  evidenceRefs: z.array(text).min(1).max(30), status: z.literal("pending"),
};
const action = z.discriminatedUnion("type", [
  z.object({ ...actionBase, type: z.literal("add_comment"), payload: z.object({ issueKey: key, body: text }).strict() }).strict(),
  z.object({ ...actionBase, type: z.literal("create_subtask"), payload: z.object({
    parentKey: key, summary: z.string().trim().min(1).max(255), description: text.optional(), assignee: text.optional(),
  }).strict() }).strict(),
  z.object({ ...actionBase, type: z.literal("assign_issue"), payload: z.object({ issueKey: key, user: text }).strict() }).strict(),
  z.object({ ...actionBase, type: z.literal("set_priority"), payload: z.object({ issueKey: key, priority: text }).strict() }).strict(),
]);
export const planSchema = z.object({
  planId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), version: z.number().int().positive(),
  issueKey: key, snapshotVersion: text, snapshotHash: text,
  findings: z.array(text).max(50), hypotheses: z.array(text).max(50), missingInfo: z.array(text).max(50),
  actions: z.array(action).min(1).max(10),
  // Legacy P3 channel is accepted for compatibility, but NEVER used as destination.
  slackDraft: z.object({ channel: z.string().optional().default(""), text: z.string().max(4000) }).strict(),
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
  for (const a of plan.actions) {
    const target = "parentKey" in a.payload ? a.payload.parentKey : a.payload.issueKey;
    if (target !== plan.issueKey) throw new Error("DESTINATION_NOT_ALLOWED");
  }
  const expires = Date.parse(plan.expiresAt), created = Date.parse(plan.createdAt);
  if (expires <= Date.now() || created > Date.now() + 60_000 ||
      expires - created > loadEnv().planTtlMinutes * 60_000) throw new Error("PLAN_EXPIRED");
  return plan;
}
