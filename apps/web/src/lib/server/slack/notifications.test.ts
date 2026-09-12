import assert from "node:assert/strict";
import test from "node:test";
import { SlackClientError, type SlackClient } from "./client";
import {
  createSlackNotificationService,
  type SlackNotificationRequest,
} from "./notifications";

const request: SlackNotificationRequest = {
  executionId: "execution-1",
  planId: "plan-1",
  planVersion: 1,
  issueKey: "WP-42",
  jiraStatus: "verified",
  draft: {
    text: "WP-42 is ready for the team.",
  },
};

test("blocks Slack before Jira verification and without a configured recipient", async () => {
  let calls = 0;
  const client: SlackClient = {
    async postMessage() {
      calls++;
      throw new Error("must not be called");
    },
  };
  const service = createSlackNotificationService({
    client,
    recipientUserId: "U0123456789",
  });

  const beforeVerification = await service.send({
    ...request,
    jiraStatus: "executing",
  });
  assert.equal(beforeVerification.status, "blocked");
  assert.equal(beforeVerification.error.code, "jira_not_verified");

  const missingRecipientService = createSlackNotificationService({
    client,
    recipientUserId: "",
  });
  const missingRecipient = await missingRecipientService.send(request);
  assert.equal(missingRecipient.status, "blocked");
  assert.equal(missingRecipient.error.code, "recipient_not_configured");
  assert.equal(calls, 0);
});

test("returns the provider ID only after Slack confirms the message", async () => {
  const client: SlackClient = {
    async postMessage(input) {
      assert.deepEqual(input, {
        recipientUserId: "U0123456789",
        text: request.draft.text,
      });
      return {
        provider: "slack",
        providerId: "D0123456789:1789234567.000100",
        recipientUserId: "U0123456789",
        conversationId: "D0123456789",
        messageTs: "1789234567.000100",
      };
    },
  };
  const service = createSlackNotificationService({
    client,
    recipientUserId: "U0123456789",
    now: () => new Date("2026-09-12T18:00:00.000Z"),
  });

  assert.deepEqual(await service.send(request), {
    status: "succeeded",
    provider: "slack",
    providerId: "D0123456789:1789234567.000100",
    recipientUserId: "U0123456789",
    conversationId: "D0123456789",
    messageTs: "1789234567.000100",
    sentAt: "2026-09-12T18:00:00.000Z",
  });
});

test("keeps safe retryable failures separate from uncertain delivery", async () => {
  for (const scenario of [
    {
      error: new SlackClientError({
        code: "rate_limited",
        message: "Slack rate limit reached.",
        retryable: true,
        deliveryState: "not_sent",
        retryAfterSeconds: 3,
      }),
      status: "failed",
      retryable: true,
    },
    {
      error: new SlackClientError({
        code: "transport_error",
        message: "Slack delivery could not be confirmed.",
        retryable: false,
        deliveryState: "unknown",
      }),
      status: "uncertain",
      retryable: false,
    },
  ] as const) {
    const service = createSlackNotificationService({
      client: {
        async postMessage() {
          throw scenario.error;
        },
      },
      recipientUserId: "U0123456789",
    });
    const result = await service.send(request);
    assert.equal(result.status, scenario.status);
    if ("error" in result) {
      assert.equal(result.error.retryable, scenario.retryable);
      if (scenario.status === "failed") {
        assert.equal(result.error.retryAfterSeconds, 3);
      }
    }
  }
});
