import { SlackClientError, type SlackClient, type SlackReceipt } from "./client";
export type SlackNotificationRequest = {
  executionId: string; planId: string; planVersion: number; issueKey: string;
  jiraStatus: "pending" | "executing" | "failed" | "uncertain" | "verified";
  draft: { text: string };
};
export type SlackNotificationResult =
  | ({ status: "succeeded"; sentAt: string } & SlackReceipt)
  | { status: "blocked" | "failed" | "uncertain";
      error: { code: string; message: string; retryable: boolean; retryAfterSeconds?: number } };
export function createSlackNotificationService(options: {
  client: SlackClient; recipientUserId: string; now?: () => Date;
}) {
  return { async send(request: SlackNotificationRequest): Promise<SlackNotificationResult> {
    if (request.jiraStatus !== "verified") return { status: "blocked",
      error: { code: "jira_not_verified", message: "Jira is not verified.", retryable: false } };
    if (!/^[UW][A-Z0-9]+$/.test(options.recipientUserId)) return { status: "blocked",
      error: { code: "recipient_not_configured", message: "Slack recipient is not configured.", retryable: false } };
    try {
      const result = await options.client.postMessage({ recipientUserId: options.recipientUserId, text: request.draft.text });
      return { ...result, status: "succeeded", sentAt: (options.now?.() || new Date()).toISOString() };
    } catch (error) {
      if (error instanceof SlackClientError) return {
        status: error.deliveryState === "unknown" ? "uncertain" : "failed",
        error: { code: error.code, message: error.message, retryable: error.retryable,
          retryAfterSeconds: error.retryAfterSeconds },
      };
      return { status: "uncertain", error: { code: "delivery_unknown",
        message: "Slack delivery could not be confirmed.", retryable: false } };
    }
  } };
}
