import type { ActionPlan, ApprovalResult } from "agent-core/workpilot/action-plan";
import { createSlackClientFromEnv } from "./client";
import { createSlackNotificationService, type SlackNotificationResult } from "./notifications";
import { getExecutionsForPlan } from "../workpilot/persistence";
import { claimRecord, readRecord, releaseRecord, writeRecord } from "../workpilot/disk";
import { rehearsalSlack } from "../workpilot/rehearsal";
export type Delivery = { status: "sending"; startedAt: string; recipientUserId: string } |
  (SlackNotificationResult & { startedAt: string; recipientUserId: string; nextRetryAt?: string });
export function getDelivery(planId: string, version: number) {
  const stored = readRecord<Delivery>("slack", planId + ":" + version);
  if (stored?.status === "sending") return { ...stored, status: "uncertain" as const,
    error: { code: "delivery_in_progress_or_interrupted", message: "Delivery is in progress or unconfirmed; do not resend.", retryable: false } };
  return stored;
}
export async function deliverSlack(plan: ActionPlan, retry = false): Promise<Delivery | undefined> {
  if (!plan.slackDraft.text.trim()) return undefined;
  const id = plan.planId + ":" + plan.version;
  if (!claimRecord("slack-locks", id)) throw new Error("CONCURRENT_EXECUTION");
  try {
    const previous = getDelivery(plan.planId, plan.version);
    if (previous && (!retry || previous.status !== "failed" || !previous.error.retryable)) return previous;
    if (previous && "nextRetryAt" in previous && previous.nextRetryAt && Date.parse(previous.nextRetryAt) > Date.now())
      throw new Error("RETRY_TOO_EARLY");
    const executions = getExecutionsForPlan(plan.planId);
    const verified = plan.actions.length > 0 && plan.actions.every(a => executions.some(e =>
      e.actionId === a.actionId && e.planVersion === plan.version && e.provider === "jira" &&
      !e.dryRun && (e.status === "succeeded" || e.status === "reconciled")));
    if (!verified) throw new Error("JIRA_NOT_VERIFIED");
    const recipientUserId = process.env.WORKPILOT_DEMO === "true" ? "UREHEARSAL" : process.env.SLACK_RECIPIENT_USER_ID || "";
    if (previous?.recipientUserId !== undefined && previous.recipientUserId !== recipientUserId)
      throw new Error("RECIPIENT_CHANGED");
    const startedAt = new Date().toISOString();
    writeRecord("slack", id, { status: "sending", startedAt, recipientUserId });
    let result: SlackNotificationResult;
    try {
      const client = process.env.WORKPILOT_DEMO === "true" ? rehearsalSlack : createSlackClientFromEnv();
      result = await createSlackNotificationService({ client, recipientUserId }).send({
        executionId: id, planId: plan.planId, planVersion: plan.version,
        issueKey: plan.issueKey, jiraStatus: "verified", draft: { text: plan.slackDraft.text },
      });
    } catch {
      result = { status: "blocked", error: { code: "slack_not_configured", message: "Slack is not configured.", retryable: false } };
    }
    const delay = "error" in result ? result.error.retryAfterSeconds : undefined;
    const delivery: Delivery = { ...result, startedAt, recipientUserId,
      ...(delay ? { nextRetryAt: new Date(Date.now() + delay * 1000).toISOString() } : {}) };
    writeRecord("slack", id, delivery);
    return delivery;
  } finally { releaseRecord("slack-locks", id); }
}
export function slackSummary(delivery?: Delivery): Pick<ApprovalResult, "slackStatus" | "slackProviderId"> {
  if (!delivery) return { slackStatus: "skipped" };
  if (delivery.status === "succeeded") return { slackStatus: "sent", slackProviderId: delivery.providerId };
  return { slackStatus: delivery.status === "failed" ? "failed" : "pending" };
}
