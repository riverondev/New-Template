import { z } from "zod";
const text = z.string().trim().min(1).max(4000);
const refs = z.array(text).max(30);
const base = { actionId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), evidenceRefs: refs.min(1) };
const forbiddenTopLevelKeys = new Set(["approve", "planId", "version", "status", "draft", "dryRun", "createdAt", "expiresAt", "slackDraft", "action"]);
const forbiddenActionKeys = new Set(["status", "payload", "before", "planId", "version", "dryRun", "approve"]);
const proposalBody = z.object({
  issueKey: z.string().regex(/^[A-Z][A-Z0-9_]*-[1-9][0-9]*$/),
  snapshotHash: text,
  reasoning: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("fact"), statementId: text, text, evidenceRefs: refs.min(1) }).passthrough(),
    z.object({ kind: z.literal("hypothesis"), statementId: text, text, evidenceRefs: refs.min(1) }).passthrough(),
    z.object({ kind: z.literal("missing_information"), missingInfoId: text, text, blocking: z.boolean(), evidenceRefs: refs }).passthrough(),
  ])).max(50),
  proposedActions: z.array(z.discriminatedUnion("type", [
    z.object({ ...base, type: z.literal("add_comment"), after: z.object({ body: text }).passthrough() }).passthrough(),
    z.object({ ...base, type: z.literal("create_subtask"), after: z.object({ summary: text.max(255), description: text.optional() }).passthrough() }).passthrough(),
    z.object({ ...base, type: z.literal("assign_issue"), after: z.object({ accountId: text }).passthrough() }).passthrough(),
    z.object({ ...base, type: z.literal("set_priority"), after: text }).passthrough(),
  ])).max(10),
  slackText: z.string().max(4000).optional(),
}).passthrough().superRefine((value, ctx) => {
  for (const key of forbiddenTopLevelKeys) {
    if (key in value) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `Forbidden control field: ${key}` });
    }
  }
  for (const [index, action] of (value.proposedActions ?? []).entries()) {
    for (const key of forbiddenActionKeys) {
      if (typeof action === "object" && action && key in action) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["proposedActions", index, key], message: `Forbidden action field: ${key}` });
      }
    }
  }
});
export const proposalSchema = proposalBody;
