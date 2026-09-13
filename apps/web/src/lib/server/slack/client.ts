export type SlackReceipt = {
  provider: "slack"; providerId: string; recipientUserId: string;
  conversationId: string; messageTs: string;
};
export type SlackClient = {
  postMessage(input: { recipientUserId: string; text: string }): Promise<SlackReceipt>;
};
type Failure = { code: string; message: string; retryable: boolean;
  deliveryState: "not_sent" | "unknown"; retryAfterSeconds?: number };
export class SlackClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly deliveryState: "not_sent" | "unknown";
  readonly retryAfterSeconds?: number;
  constructor(f: Failure) { super(f.message); this.name = "SlackClientError";
    this.code = f.code; this.retryable = f.retryable; this.deliveryState = f.deliveryState;
    this.retryAfterSeconds = f.retryAfterSeconds; }
}
function unavailable(code: string, message: string) {
  return new SlackClientError({ code, message, retryable: false, deliveryState: "not_sent" });
}
function uncertain() {
  return new SlackClientError({ code: "delivery_unknown", message: "Slack delivery could not be confirmed.",
    retryable: false, deliveryState: "unknown" });
}
export function createSlackClient({ token, fetchImpl = fetch }: { token: string; fetchImpl?: typeof fetch }): SlackClient {
  if (!token?.trim()) throw unavailable("slack_not_configured", "Slack is not configured.");
  return { async postMessage(input) {
    const recipientUserId = input.recipientUserId.trim(), text = input.text.trim();
    if (!/^[UW][A-Z0-9]+$/.test(recipientUserId)) throw unavailable("invalid_recipient", "Invalid Slack recipient.");
    if (!text || text.length > 4000) throw unavailable("invalid_text", "Invalid Slack text.");
    try {
      const response = await fetchImpl("https://slack.com/api/chat.postMessage", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ channel: recipientUserId, text, unfurl_links: false, unfurl_media: false,
          mrkdwn: false, parse: "none" }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 429) {
        const delay = Number(response.headers.get("retry-after") || 1);
        throw new SlackClientError({ code: "rate_limited", message: "Slack rate limit reached.",
          retryable: true, deliveryState: "not_sent", retryAfterSeconds: Number.isFinite(delay) ? Math.max(1, delay) : 60 });
      }
      if (response.status >= 500) throw uncertain();
      if (!response.ok) throw unavailable("slack_http_error", "Slack rejected the request.");
      const body = await response.json();
      if (body.ok === false) {
        const allowed = ["missing_scope", "invalid_auth", "token_revoked", "channel_not_found", "not_in_channel", "account_inactive"];
        throw unavailable(allowed.includes(body.error) ? body.error : "slack_rejected", "Slack rejected the message.");
      }
      if (body.ok !== true || typeof body.channel !== "string" || !/^D[A-Z0-9]+$/.test(body.channel)
        || typeof body.ts !== "string" || !/^\d+\.\d+$/.test(body.ts)) throw uncertain();
      return { provider: "slack", providerId: body.channel + ":" + body.ts, recipientUserId,
        conversationId: body.channel, messageTs: body.ts };
    } catch (error) {
      if (error instanceof SlackClientError) throw error;
      throw uncertain();
    }
  } };
}
export function createSlackClientFromEnv(env: Record<string, string | undefined> = process.env) {
  return createSlackClient({ token: env.SLACK_BOT_TOKEN || "" });
}
