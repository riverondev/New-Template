# WorkPilot Slack integration contract

## Approved scope

Slack is a private, outgoing notification only. WorkPilot sends one approved
message to a fixed user's Slack App Home after every Jira action has completed
and Jira read-back has verified the real result.

The Slack App does not process replies. Its Messages tab must be enabled in
read-only mode. No public channel, conversational bot, Events API subscription,
Socket Mode, incoming webhook, signing secret, or public callback URL belongs
to this MVP path.

The adapter uses Slack Web API
[`chat.postMessage`](https://docs.slack.dev/reference/methods/chat.postMessage/)
with a bot token carrying the
[`chat:write`](https://docs.slack.dev/reference/scopes/chat.write/) scope. Passing
a Slack user ID as `channel` starts or resumes that user's private App Home
conversation with the app.

## Local configuration

```dotenv
SLACK_BOT_TOKEN=xoxb-...
SLACK_RECIPIENT_USER_ID=U0123456789
```

Create and install a Slack App in a workspace controlled by the team. Enable
the App Home Messages tab in read-only mode and copy the demo recipient's stable
Slack user ID. Do not commit the token or include it in logs, screenshots,
fixtures, or the demo video.

## Input expected from the executor

```ts
type SlackNotificationRequest = {
  executionId: string;
  planId: string;
  planVersion: number;
  issueKey: string;
  jiraStatus: "pending" | "executing" | "failed" | "uncertain" | "verified";
  draft: {
    text: string;
  };
};
```

The service rejects the request unless `jiraStatus === "verified"`. The server,
not the agent or browser, injects `SLACK_RECIPIENT_USER_ID`.

## Result returned to persistence and UI

Successful delivery returns:

```ts
{
  status: "succeeded";
  provider: "slack";
  providerId: `${conversationId}:${messageTs}`;
  recipientUserId: string;
  conversationId: string;
  messageTs: string;
  sentAt: string;
}
```

Slack returns a private conversation ID beginning with `D` and a message
timestamp. Together they identify the real message without inventing a link.

## Simple retry policy

There is no automatic retry or scheduler.

- `succeeded`: persist the provider ID and do not send again.
- `failed`: Slack confirmed that it did not accept the message. The UI may
  offer a manual **Retry Slack** only when `retryable` is true.
- `uncertain`: the request may have reached Slack but confirmation was lost.
  Do not offer a blind retry because it can duplicate the private message.
- `blocked`: Jira is not verified or the recipient is not configured.

A manual retry reloads the existing execution and calls only Slack. It must
never repeat Jira actions.

## Contract requested from P1

1. Generate only `slackDraft.text`; the destination is not model-controlled.
2. Include the issue key, verified action summary, real Jira IDs, and remaining
   manual work. Do not include unsupported claims.
3. Omit the draft when there are no approved Jira actions.
4. Use accessible plain text for the MVP; defer rich Slack blocks.

## Contract requested from P2

1. Show the Slack text as immutable approved content.
2. Do not expose a channel or recipient selector.
3. Render `succeeded`, `failed`, `uncertain`, and `blocked` separately.
4. Offer **Retry Slack** only for `failed && retryable`.
5. For partial failure, show: “Jira actualizado; aviso de Slack pendiente.”

## Contract requested from P3

1. Emit `jiraStatus: "verified"` only after all approved Jira writes have been
   read back and matched.
2. Persist Slack separately from Jira:
   `pending → sending → succeeded | failed | uncertain`.
3. Atomically claim `slack:${planId}:${planVersion}` before sending.
4. Store `providerId`, recipient user ID, conversation ID, message timestamp,
   safe error, retryability, and attempt timestamps.
5. A manual Slack retry must never call a Jira write method.
6. Do not retry `uncertain` automatically.

## Acceptance checks

- Jira not verified: zero calls to Slack.
- Recipient missing or invalid: zero calls to Slack.
- Successful response: real private conversation ID and timestamp returned.
- Slack logical failure: Jira stays successful and Slack is failed.
- HTTP 429: no automatic retry; expose the provider delay for a later manual
  retry.
- Timeout, network loss, HTTP 5xx, or malformed success: uncertain, no retry.
- Double approval: one Jira effect and one private Slack message.
- Manual Slack retry: zero Jira calls.
