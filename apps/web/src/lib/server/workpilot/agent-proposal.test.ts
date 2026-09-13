import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleWorkpilot } from "./http";
import { listRecords, readRecord } from "./disk";
import { rehearsalJira } from "./rehearsal";
import { verifyWrite } from "./executor";
import { getIssueComments } from "../jira/comments";
import type { IJiraClient } from "../jira/client";
const directory = mkdtempSync(join(tmpdir(), "workpilot-agent-"));
process.env.WORKPILOT_DATA_DIR = directory;
process.env.WORKPILOT_DEMO = "true";
process.env.JIRA_PROJECT_KEY = "WP";
after(() => rmSync(directory, { recursive: true, force: true }));
let cookie = "";
async function call(resource: string, body?: unknown) {
  const response = await handleWorkpilot(new Request("http://localhost:3100/api/workpilot/" + resource, {
    method: body === undefined ? "GET" : "POST",
    headers: { origin: "http://localhost:3100", "content-type": "application/json", cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), resource.split("?")[0]);
  if (response.headers.has("set-cookie")) cookie = response.headers.get("set-cookie")!.split(";")[0];
  return { status: response.status, body: await response.json() };
}
function proposal(read: any, body = "Preparar la revision final del handoff.") {
  const ref = read.evidence.find((e: any) => e.sourceType === "comment").evidenceId;
  return { issueKey: read.context.issueKey, snapshotHash: read.snapshotHash,
    reasoning: [{ kind: "fact", statementId: "f1", text: read.context.comments[0].body, evidenceRefs: [ref] }],
    proposedActions: [{ actionId: "comment1", type: "add_comment", after: { body }, evidenceRefs: [ref] }],
    slackText: "Handoff actualizado tras verificar Jira.",
  };
}
test("agent candidates cross server policy, persist, await approval, execute and follow up from fresh Jira", async () => {
  const read = await call("agent-context?issueKey=WP-42");
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.ok(read.body.context.comments[0].createdAt);
  assert.ok(read.body.snapshotHash);
  const draft = proposal(read.body);
  const saved = await call("propose", draft);
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  const plan = saved.body.plan;
  assert.ok(plan.createdAt); assert.equal(plan.status, "pending");
  assert.equal(plan.actions[0].payload.body, plan.actions[0].after.body);
  assert.equal(listRecords("executions").length, 0);
  assert.equal(listRecords("fixture-slack").length, 0);
  const approved = await call("approve", { planId: plan.planId, version: plan.version });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.result.actions[0].status, "succeeded");
  assert.equal(approved.body.result.slackStatus, "sent");
  const fresh = (await call("agent-context?issueKey=WP-42")).body;
  assert.notEqual(fresh.snapshotHash, read.body.snapshotHash);
  assert.equal(fresh.execution.actions[0].status, "succeeded");
  assert.ok(fresh.context.comments.some((c: any) => c.body === draft.proposedActions[0].after.body));
  assert.equal((await call("propose", draft)).body.error, "SNAPSHOT_CHANGED");
  const duplicate = await call("propose", proposal(fresh));
  assert.equal(duplicate.body.plan.actions.length, 0);
  assert.equal(duplicate.body.plan.slackDraft, undefined);
  assert.equal((await call("approve", { planId: duplicate.body.plan.planId, version: 1 })).body.error, "PLAN_NO_ACTIONS");
  const readB = (await call("agent-context?issueKey=WP-57")).body;
  assert.notDeepEqual(readB.evidence, read.body.evidence);
  const other = await call("propose", proposal(readB, "Resumen especifico del segundo ticket."));
  assert.equal(other.status, 201);
  assert.equal((await call("reject", { planId: other.body.plan.planId, version: 1 })).status, 200);
  assert.equal((await call("agent-context?issueKey=WP-57")).body.plan.status, "rejected");
});
test("unknown evidence, duplicate work and invented assignment never become executable actions", async () => {
  const read = (await call("agent-context?issueKey=WP-42")).body;
  const draft: any = proposal(read, "Different action.");
  draft.proposedActions[0].evidenceRefs = ["invented"];
  draft.proposedActions.push({ actionId: "duplicate", type: "create_subtask",
    after: { summary: "Implementar fix" }, evidenceRefs: [read.evidence[0].evidenceId] });
  draft.proposedActions.push({ actionId: "assign", type: "assign_issue",
    after: { accountId: "invented-account" }, evidenceRefs: [read.evidence[0].evidenceId] });
  const result = await call("propose", draft);
  assert.equal(result.status, 201);
  assert.equal(result.body.plan.actions.length, 0);
  assert.equal(result.body.rejectedActions.length, 3);
  assert.equal(result.body.plan.slackDraft, undefined);
  assert.equal((await call("propose", { ...draft, issueKey: "OTHER-1" })).status, 409);
  assert.equal((await call("propose", { ...draft, approve: true })).status, 400);
});
test("assignment read-back compares stable accountId, not displayName", async () => {
  const original = rehearsalJira.get;
  rehearsalJira.get = async <T>(): Promise<T> => ({ key: "WP-42", fields: {
    summary: "Ticket", status: { name: "Open" }, priority: { name: "High" },
    assignee: { displayName: "Ana Perez", accountId: "account-123" }, updated: new Date().toISOString(),
  } }) as T;
  try {
    assert.equal(await verifyWrite({ actionId: "a", type: "assign_issue", after: { accountId: "account-123" },
      evidenceRefs: ["e"], status: "pending" }, "WP-42"), true);
  } finally { rehearsalJira.get = original; }
});
test("comments pagination reaches later comments and fails closed on non-progress", async () => {
  const calls: string[] = [];
  const client: IJiraClient = {
    get: async <T>(path: string): Promise<T> => {
      calls.push(path);
      return { total: 2, comments: [{ id: path.includes("startAt=1") ? "2" : "1",
        author: { displayName: "Ana" }, body: "Comment", created: "2026-09-12T10:00:00.000Z" }] } as T;
    }, post: async () => { throw new Error("Unexpected write"); }, put: async () => { throw new Error("Unexpected write"); },
  };
  assert.deepEqual((await getIssueComments("WP-42", client)).map(c => c.id), ["1", "2"]);
  assert.equal(calls.length, 2);
  client.get = async <T>(): Promise<T> => ({ total: 2, comments: [] }) as T;
  await assert.rejects(getIssueComments("WP-42", client), /INCOMPLETE_COMMENTS/);
});
