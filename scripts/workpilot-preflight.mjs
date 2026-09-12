import { existsSync, readFileSync, mkdirSync, accessSync, constants } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const demo = process.env.WORKPILOT_DEMO === "true";
const checks = [];
function check(name, ok, detail) { checks.push({ name, ok, detail }); }
check("Node >=22", Number(process.versions.node.split(".")[0]) >= 22, process.versions.node);
check("Web workspace", existsSync(resolve(root, "apps/web/package.json")), "apps/web");
check("Agent Core workspace", existsSync(resolve(root, "packages/agent-core/package.json")), "packages/agent-core");
check("Dependencies", existsSync(resolve(root, "node_modules/next/package.json")), "Run npm ci if missing.");
check("Mode", true, demo ? "REHEARSAL: simulated Jira/Slack; no model." : "LIVE: real providers; explicit page approval required.");
const configured = key => !!process.env[key]?.trim() && !/stub|replace-me|your-key/i.test(process.env[key]);
if (!demo) {
  for (const key of ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN", "JIRA_PROJECT_KEY", "SLACK_BOT_TOKEN", "SLACK_RECIPIENT_USER_ID"])
    check(key, configured(key), configured(key) ? "configured (value hidden)" : "missing");
  try { const u = new URL(process.env.JIRA_BASE_URL); check("Jira origin", u.protocol === "https:" && !u.username && !u.password && u.pathname === "/", "HTTPS origin required."); }
  catch { check("Jira origin", false, "Set JIRA_BASE_URL."); }
  check("Slack recipient", /^[UW][A-Z0-9]+$/.test(process.env.SLACK_RECIPIENT_USER_ID || ""), "Fixed App Home user ID.");
  check("Jira writes", process.env.JIRA_WRITES_ENABLED === "true", "Enable only for an approved live rehearsal.");
  check("Jira subtask type", configured("JIRA_SUBTASK_ISSUE_TYPE_ID"), "Required for create_subtask.");
  const provider = process.env.MODEL_PROVIDER || "openai";
  check("Model configuration", configured(provider === "openrouter" ? "OPENROUTER_API_KEY" : "OPENAI_API_KEY") && configured("MODEL"), "Configuration only; no model invocation.");
}
const dataDir = resolve(process.env.WORKPILOT_DATA_DIR || resolve(root, "apps/web/.data/workpilot"), demo ? "rehearsal" : "live");
try { mkdirSync(dataDir, { recursive: true }); accessSync(dataDir, constants.R_OK | constants.W_OK); check("Persistent disk", true, "Readable and writable."); }
catch { check("Persistent disk", false, "WORKPILOT_DATA_DIR must be writable."); }
if (process.argv.includes("--live") && !demo && checks.every(c => c.ok)) {
  const auth = Buffer.from(process.env.JIRA_EMAIL + ":" + process.env.JIRA_API_TOKEN).toString("base64");
  for (const path of ["/myself", "/project/" + encodeURIComponent(process.env.JIRA_PROJECT_KEY)]) {
    try { const r = await fetch(process.env.JIRA_BASE_URL.replace(/\/$/, "") + "/rest/api/3" + path,
      { headers: { Authorization: "Basic " + auth }, signal: AbortSignal.timeout(10_000) });
      check("Jira " + path.split("/")[1], r.ok, "HTTP " + r.status); }
    catch { check("Jira connectivity", false, "Request failed; no provider payload logged."); }
  }
  try {
    const r = await fetch("https://slack.com/api/auth.test", { method: "POST",
      headers: { Authorization: "Bearer " + process.env.SLACK_BOT_TOKEN }, signal: AbortSignal.timeout(10_000) });
    const body = await r.json();
    check("Slack authentication", body.ok === true, "Read-only authentication check; no message sent.");
  } catch { check("Slack authentication", false, "Request failed."); }
}
const p1Ready = ["prompt", "context", "tools"].every(name =>
  !/^\s*export\s*\{\s*\};?\s*$/.test(readFileSync(resolve(root, "packages/agent-core/src/workpilot/" + name + ".ts"), "utf8")));
console.table(checks);
console.log("P1 handoff:", p1Ready ? "source present; behavioral acceptance still required." : "PENDING — agent behavior not implemented; rehearsal fixtures are not AI.");
if (process.argv.includes("--release") && !p1Ready) process.exitCode = 1;
if (checks.some(c => !c.ok)) process.exitCode = 1;
