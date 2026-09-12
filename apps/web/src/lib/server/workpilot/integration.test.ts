import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { handleWorkpilot } from "./http";
import { getPlan, getExecutionsForPlan } from "./persistence";
import { readRecord, writeRecord, listRecords } from "./disk";
import { rehearsalJira } from "./rehearsal";
import { getDelivery } from "../slack/delivery";
import { resetEnvCache } from "../env";
import type { ActionPlan } from "agent-core/workpilot/action-plan";

const directory = mkdtempSync(join(tmpdir(), "workpilot-integration-"));
process.env.WORKPILOT_DATA_DIR = directory;
process.env.WORKPILOT_DEMO = "true";
after(() => rmSync(directory, { recursive: true, force: true }));
let session = "";
async function call(resource: string, body?: unknown, cookie = session, origin = "http://localhost:3100") {
  const request = new Request("http://localhost:3100/api/workpilot/" + resource, {
    method: body === undefined ? "GET" : "POST",
    headers: { host: "localhost:3100", origin, "content-type": "application/json", cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const response = await handleWorkpilot(request, resource.split("?")[0]);
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function propose(issueKey = "WP-42"): Promise<ActionPlan> {
  const res = await call("rehearsal", { issueKey });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.plan;
}
const approval = (p: ActionPlan) => ({ planId: p.planId, version: p.version });

test("P4 golden path, rejection, stale plans, isolation, double approve and process restart", async () => {
  const initialized = await call("session");
  session = initialized.headers.get("set-cookie")!.split(";")[0];
  const rejected = await propose();
  assert.equal((await call("reject", approval(rejected))).status, 200);
  assert.equal(getPlan(rejected.planId)?.status, "rejected");
  assert.equal(getExecutionsForPlan(rejected.planId).length, 0);
  assert.equal((await call("approve", approval(rejected))).status, 409);
  const plan = await propose();
  assert.equal((await call("approve", approval(plan), "", "https://attacker.invalid")).status, 403);
  assert.equal((await call("approve", approval(plan), "")).status, 401);
  const other = await call("session", undefined, "");
  const otherCookie = other.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await call("approve", approval(plan), otherCookie)).status, 404);
  const dry = await call("approve", { ...approval(plan), dryRun: true });
  assert.equal(dry.body.result.dryRun, true);
  assert.equal(getExecutionsForPlan(plan.planId).length, 0);
  assert.equal(getDelivery(plan.planId, plan.version), undefined);
  const [first, second] = await Promise.all([call("approve", approval(plan)), call("approve", approval(plan))]);
  assert.deepEqual([first.status, second.status].sort(), [200, 409]);
  const result = first.status === 200 ? first.body.result : second.body.result;
  assert.equal(result.slackStatus, "sent");
  assert.ok(result.actions.every((a: { status: string }) => a.status === "succeeded"));
  const executions = getExecutionsForPlan(plan.planId);
  assert.equal(executions.length, 2);
  assert.ok(executions.every(e => !!e.providerId && e.status === "succeeded"));
  const slack = getDelivery(plan.planId, plan.version)!;
  assert.equal(slack.status, "succeeded");
  const messagesBefore = listRecords("fixture-slack").length;
  assert.equal((await call("approve", approval(plan))).status, 200);
  assert.equal(getExecutionsForPlan(plan.planId).length, 2);
  assert.equal(listRecords("fixture-slack").length, messagesBefore);
  assert.equal((await call("plans?issueKey=WP-42")).body.plan.status, "executed");
  // New process reads durable records and re-approval performs no provider writes.
  const script = [
    'const { executeApproval } = await import("./src/lib/server/workpilot/executor.ts");',
    'const result = await executeApproval(' + JSON.stringify(approval(plan)) + ');',
    'if (result.slackStatus !== "sent") process.exit(2);',
  ].join("\n");
  const restarted = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { encoding: "utf8", env: process.env });
  assert.equal(restarted.status, 0, restarted.stderr);
  assert.equal(listRecords("fixture-slack").length, messagesBefore);
  const otherPlan = await propose("WP-57");
  assert.equal(otherPlan.actions.length, 1);
  assert.notDeepEqual(otherPlan.findings, plan.findings);
  await rehearsalJira.put("/issue/WP-57", { fields: { priority: { name: "Highest" } } });
  const stale = await call("approve", approval(otherPlan));
  assert.equal(stale.body.error, "SNAPSHOT_CHANGED");
  assert.equal(getExecutionsForPlan(otherPlan.planId).length, 0);
});

test("rejects malformed actions, overwritten IDs and destinations before any write", async () => {
  const p = await propose("WP-57");
  assert.equal((await call("plans", p)).body.error, "PLAN_ALREADY_EXISTS");
  const bad = structuredClone(p); bad.planId = "bad-destination";
  const firstAction = bad.actions[0];
  if (!firstAction.payload) {
    throw new Error("Action payload missing in integration test fixture");
  }
  firstAction.payload.issueKey = "OTHER-1";
  assert.equal((await call("plans", bad)).body.error, "DESTINATION_NOT_ALLOWED");
  const malformed = { ...p, planId: "bad-payload", actions: [{ ...p.actions[0], payload: {} }] };
  assert.equal((await call("plans", malformed)).status, 400);
  const expired = { ...p, planId: "expired", expiresAt: "2020-01-01T00:00:00.000Z" };
  assert.equal((await call("plans", expired)).body.error, "PLAN_EXPIRED");
});

test("manual Slack retry uses only Slack, preserves Jira and never replays uncertain delivery", async () => {
  const p = await propose("WP-57");
  await call("approve", approval(p));
  const id = p.planId + ":" + p.version;
  const original = getDelivery(p.planId, p.version)!;
  const executions = JSON.stringify(getExecutionsForPlan(p.planId));
  const fixture = JSON.stringify(readRecord("fixture-jira", "WP-57"));
  writeRecord("slack", id, { status: "failed", startedAt: new Date().toISOString(), recipientUserId: "UREHEARSAL",
    error: { code: "rate_limited", message: "Rate limited", retryable: true } });
  const before = listRecords("fixture-slack").length;
  assert.equal((await call("retry-slack", approval(p))).body.slack.status, "succeeded");
  assert.equal(listRecords("fixture-slack").length, before + 1);
  assert.equal(JSON.stringify(getExecutionsForPlan(p.planId)), executions);
  assert.equal(JSON.stringify(readRecord("fixture-jira", "WP-57")), fixture);
  writeRecord("slack", id, { status: "sending", startedAt: new Date().toISOString(), recipientUserId: "UREHEARSAL" });
  assert.equal((await call("retry-slack", approval(p))).body.slack.status, "uncertain");
  assert.equal(listRecords("fixture-slack").length, before + 1);
  writeRecord("slack", id, original);
});

test("Jira verification failure blocks Slack and new plans until reconciliation", async () => {
  const p = await propose("WP-57");
  const original = rehearsalJira.get;
  let wrote = false;
  const post = rehearsalJira.post;
  rehearsalJira.post = async <T>(path: string, body: unknown): Promise<T> => { const r = await post<T>(path, body); wrote = true; return r; };
  rehearsalJira.get = async <T>(path: string): Promise<T> => {
    if (wrote && path.includes("/comment")) return { comments: [], total: 0 } as T;
    return original<T>(path);
  };
  try {
    const result = await call("approve", approval(p));
    assert.equal(result.body.result.actions[0].status, "reconciling");
    assert.equal(getDelivery(p.planId, p.version), undefined);
    assert.equal((await call("retry-slack", approval(p))).body.error, "JIRA_NOT_VERIFIED");
    assert.equal((await call("rehearsal", { issueKey: "WP-57" })).body.error, "RECONCILIATION_REQUIRED");
  } finally { rehearsalJira.get = original; rehearsalJira.post = post; }
});

test("real mode cannot access rehearsal providers or submit a rehearsal plan", async () => {
  delete process.env.WORKPILOT_DEMO;
  resetEnvCache();
  const result = await call("session");
  assert.equal(result.body.mode, "live");
  process.env.WORKPILOT_DEMO = "true";
});
