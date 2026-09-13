// HTTP end-to-end against the real Next.js production server. Providers are
// isolated local fixtures. No browser install or external credentials required.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
const root = resolve(import.meta.dirname, "..");
const directory = mkdtempSync(join(tmpdir(), "workpilot-http-e2e-"));
const port = 3197, base = "http://127.0.0.1:" + port;
let child, cookie = "", logs = "";
async function start() {
  child = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: resolve(root, "apps/web"), env: { ...process.env, WORKPILOT_DEMO: "true", WORKPILOT_DATA_DIR: directory, JIRA_PROJECT_KEY: "WP" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", b => { logs += b; }); child.stderr.on("data", b => { logs += b; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Next server exited. " + logs.slice(-3000));
    try { const r = await fetch(base + "/api/workpilot/session"); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("Next did not start.");
}
async function stop() {
  if (child && child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
}
async function call(path, body, session = cookie) {
  const r = await fetch(base + "/api/workpilot/" + path, {
    method: body ? "POST" : "GET", headers: { cookie: session, origin: base, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, cookie: r.headers.get("set-cookie")?.split(";")[0], body: await r.json() };
}
try {
  await start();
  assert.equal((await fetch(base)).status, 200);
  const s = await call("session"); cookie = s.cookie; assert.equal(s.body.mode, "rehearsal");
  const read = await call("agent-context?issueKey=WP-42");
  assert.equal(read.status, 200, JSON.stringify(read.body));
  const evidenceRef = read.body.evidence.find(e => e.sourceType === "comment").evidenceId;
  const proposal = await call("propose", {
    issueKey: "WP-42", snapshotHash: read.body.snapshotHash,
    reasoning: [{ kind: "fact", statementId: "f1", text: read.body.context.comments[0].body, evidenceRefs: [evidenceRef] }],
    proposedActions: [{ actionId: "handoff", type: "add_comment",
      after: { body: "HTTP QA: preparar revision del handoff." }, evidenceRefs: [evidenceRef] }],
    slackText: "HTTP QA: handoff actualizado y verificado.",
  });
  assert.equal(proposal.status, 201, JSON.stringify(proposal.body));
  const p = proposal.body.plan;
  assert.equal((await call("plans?issueKey=WP-42")).body.result, undefined);
  assert.ok(p?.planId);
  const command = { planId: p.planId, version: p.version };
  assert.equal((await call("approve", command, "")).status, 401);
  const [a, b] = await Promise.all([call("approve", command), call("approve", command)]);
  assert.ok([a.status, b.status].includes(200));
  const result = a.status === 200 ? a.body.result : b.body.result;
  assert.equal(result.slackStatus, "sent");
  assert.ok(result.actions.every(a => a.status === "succeeded"));
  const provider = result.slackProviderId;
  assert.equal((await call("approve", command)).body.result.slackProviderId, provider);
  await stop(); await start();
  const restored = await call("plans?issueKey=WP-42");
  assert.equal(restored.body.result.slackProviderId, provider);
  assert.equal(restored.body.plan.status, "executed");
  const followup = (await call("agent-context?issueKey=WP-42")).body;
  assert.notEqual(followup.snapshotHash, read.body.snapshotHash);
  assert.equal(followup.execution.actions[0].status, "succeeded");
  assert.ok(followup.context.comments.some(c => c.body === "HTTP QA: preparar revision del handoff."));
  const p2 = (await call("rehearsal", { issueKey: "WP-57" })).body.plan;
  assert.equal(p2.actions.length, 1);
  assert.equal((await call("reject", { planId: p2.planId, version: p2.version })).status, 200);
  assert.equal((await call("plans?issueKey=WP-57")).body.plan.status, "rejected");
  console.log("PASS HTTP E2E: page → context → proposal → approval → Jira read-back → Slack → duplicate → restart → reject.");
} finally { await stop(); rmSync(directory, { recursive: true, force: true }); }
