import assert from "node:assert/strict";
import test from "node:test";
import {
  SlackClientError,
  createSlackClient,
  createSlackClientFromEnv,
} from "./client";

test("posts approved text with a server-side token and returns the real Slack ID", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const client = createSlackClient({
    token: "xoxb-secret",
    fetchImpl: (async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return Response.json({
        ok: true,
        channel: "D0123456789",
        ts: "1789234567.000100",
      });
    }) as typeof fetch,
  });

  const result = await client.postMessage({
    recipientUserId: " U0123456789 ",
    text: " Jira verified for WP-42. ",
  });

  assert.equal(capturedUrl, "https://slack.com/api/chat.postMessage");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(
    new Headers(capturedInit?.headers).get("authorization"),
    "Bearer xoxb-secret",
  );
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    channel: "U0123456789",
    text: "Jira verified for WP-42.",
    unfurl_links: false,
    unfurl_media: false,
    mrkdwn: false,
    parse: "none",
  });
  assert.deepEqual(result, {
    provider: "slack",
    providerId: "D0123456789:1789234567.000100",
    recipientUserId: "U0123456789",
    conversationId: "D0123456789",
    messageTs: "1789234567.000100",
  });
});

test("classifies rate limits as safely retryable and preserves Retry-After", async () => {
  const client = createSlackClient({
    token: "xoxb-test",
    fetchImpl: (async () =>
      new Response("rate limited", {
        status: 429,
        headers: { "retry-after": "3" },
      })) as typeof fetch,
  });

  await assert.rejects(
    client.postMessage({ recipientUserId: "U1", text: "hello" }),
    (error: unknown) => {
      assert.ok(error instanceof SlackClientError);
      assert.equal(error.code, "rate_limited");
      assert.equal(error.retryable, true);
      assert.equal(error.deliveryState, "not_sent");
      assert.equal(error.retryAfterSeconds, 3);
      return true;
    },
  );
});

test("does not retry an ambiguous server or transport outcome", async () => {
  for (const fetchImpl of [
    (async () => new Response("failure", { status: 503 })) as typeof fetch,
    (async () => {
      throw new Error("socket closed after write");
    }) as typeof fetch,
  ]) {
    const client = createSlackClient({ token: "xoxb-test", fetchImpl });
    await assert.rejects(
      client.postMessage({ recipientUserId: "U1", text: "hello" }),
      (error: unknown) => {
        assert.ok(error instanceof SlackClientError);
        assert.equal(error.retryable, false);
        assert.equal(error.deliveryState, "unknown");
        assert.equal(error.message, "Slack delivery could not be confirmed.");
        return true;
      },
    );
  }
});

test("returns controlled provider errors without leaking provider payloads", async () => {
  const client = createSlackClient({
    token: "xoxb-test",
    fetchImpl: (async () =>
      Response.json({
        ok: false,
        error: "missing_scope",
        unsafe_detail: "Bearer secret-from-provider",
      })) as typeof fetch,
  });

  await assert.rejects(
    client.postMessage({ recipientUserId: "U1", text: "hello" }),
    (error: unknown) => {
      assert.ok(error instanceof SlackClientError);
      assert.equal(error.code, "missing_scope");
      assert.equal(error.deliveryState, "not_sent");
      assert.doesNotMatch(error.message, /secret-from-provider/);
      return true;
    },
  );
});

test("fails closed when the bot token or message fields are missing", async () => {
  assert.throws(
    () => createSlackClientFromEnv({}),
    (error: unknown) =>
      error instanceof SlackClientError && error.code === "slack_not_configured",
  );

  const client = createSlackClient({ token: "xoxb-test" });
  await assert.rejects(
    client.postMessage({ recipientUserId: "", text: "hello" }),
    (error: unknown) =>
      error instanceof SlackClientError && error.code === "invalid_recipient",
  );
  await assert.rejects(
    client.postMessage({ recipientUserId: "U1", text: " " }),
    (error: unknown) =>
      error instanceof SlackClientError && error.code === "invalid_text",
  );
});
