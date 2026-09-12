import { randomBytes } from "node:crypto";
import { z } from "zod";
import { readRecord, writeRecord } from "./disk";
import { getPlan, getAllPlansForIssue, updatePlanStatus } from "./persistence";
import { readContext } from "./context";
import { storePlan } from "./plans";
import { approvalSchema, validateDraft } from "./validation";
import { executeApproval, getApprovalResult } from "./executor";
import { getDelivery, deliverSlack } from "../slack/delivery";
import { withPlanLock } from "./idempotency";
import { rehearsalPlan } from "./rehearsal";

const cookieName = "workpilot-session";
function owner(planId: string, session: string) {
  if (readRecord<string>("owners", planId) !== session) throw new Error("PLAN_NOT_FOUND");
  const plan = getPlan(planId);
  if (!plan) throw new Error("PLAN_NOT_FOUND");
  return plan;
}
export async function handleWorkpilot(request: Request, resource: string): Promise<Response> {
  const url = new URL(request.url), host = request.headers.get("host") || url.host;
  const expected = new URL(url); expected.host = host;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(expected.hostname) ||
      request.headers.get("sec-fetch-site") === "cross-site")
    return Response.json({ error: "LOOPBACK_ONLY" }, { status: 403 });
  const isPost = request.method === "POST";
  if (isPost && (request.headers.get("origin") !== expected.origin ||
      !request.headers.get("content-type")?.startsWith("application/json")))
    return Response.json({ error: "SAME_ORIGIN_REQUIRED" }, { status: 403 });
  let session = request.headers.get("cookie")?.split(";").map(x => x.trim())
    .find(x => x.startsWith(cookieName + "="))?.slice(cookieName.length + 1) || "";
  const validSession = /^[a-f0-9]{64}$/.test(session) &&
    (readRecord<{ expires: number }>("sessions", session)?.expires || 0) > Date.now();
  if (!validSession && isPost) return Response.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  if (!validSession) {
    session = randomBytes(32).toString("hex");
    writeRecord("sessions", session, { expires: Date.now() + 86400_000 });
  }
  const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: {
    "Cache-Control": "no-store",
    ...(!validSession ? { "Set-Cookie": cookieName + "=" + session +
      "; HttpOnly; SameSite=Strict; Path=/api/workpilot; Max-Age=86400" + (url.protocol === "https:" ? "; Secure" : "") } : {}),
  } });
  try {
    if (request.method === "GET") {
      if (resource === "session") return reply({ mode: process.env.WORKPILOT_DEMO === "true" ? "rehearsal" : "live",
        agentStatus: "pending_p1", writesEnabled: process.env.WORKPILOT_DEMO === "true" || process.env.JIRA_WRITES_ENABLED === "true" });
      const planId = url.searchParams.get("planId");
      if (resource === "plans" && planId) {
        const plan = owner(planId, session);
        return reply({ plan, result: getApprovalResult(plan), slack: getDelivery(plan.planId, plan.version) });
      }
      const issueKey = url.searchParams.get("issueKey") || "";
      if (resource === "context") {
        const context = await readContext(issueKey);
        return reply({ context });
      }
      if (resource === "plans") {
        const plan = getAllPlansForIssue(issueKey).filter(p => readRecord<string>("owners", p.planId) === session)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        return reply(plan ? { plan, result: getApprovalResult(plan), slack: getDelivery(plan.planId, plan.version) } : { plan: null });
      }
      return reply({ error: "NOT_FOUND" }, 404);
    }
    if (!isPost) return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
    const rawText = await request.text();
    if (rawText.length > 64_000) return reply({ error: "PAYLOAD_TOO_LARGE" }, 413);
    const raw = JSON.parse(rawText);
    if (resource === "plans" || resource === "rehearsal") {
      if (resource === "rehearsal" && process.env.WORKPILOT_DEMO !== "true") throw new Error("REHEARSAL_DISABLED");
      const draft = resource === "rehearsal"
        ? rehearsalPlan(await readContext(z.object({ issueKey: z.string() }).strict().parse(raw).issueKey))
        : validateDraft(raw);
      const plan = validateDraft(draft);
      return await withPlanLock("issue:" + plan.issueKey, async () => {
        if (getPlan(plan.planId)) throw new Error("PLAN_ALREADY_EXISTS");
        const context = await readContext(plan.issueKey);
        if (context.snapshotHash !== plan.snapshotHash || context.snapshotVersion !== plan.snapshotVersion)
          throw new Error("SNAPSHOT_CHANGED");
        // A new proposal must not erase an unresolved operation from this issue.
        if (getAllPlansForIssue(plan.issueKey).some(p => p.status === "approved" ||
          getApprovalResult(p)?.actions.some(a => a.status === "reconciling")))
          throw new Error("RECONCILIATION_REQUIRED");
        writeRecord("owners", plan.planId, session);
        storePlan(plan);
        return reply({ plan }, 201);
      });
    }
    const input = approvalSchema.parse(raw);
    const plan = owner(input.planId, session);
    if (plan.version !== input.version) throw new Error("PLAN_WRONG_VERSION");
    if (resource === "approve") return reply({ result: await executeApproval(input) });
    if (resource === "reject") return await withPlanLock(plan.planId, async () => {
      if (getPlan(plan.planId)?.status !== "pending") throw new Error("PLAN_NOT_PENDING");
      updatePlanStatus(plan.planId, "rejected"); return reply({ status: "rejected" });
    });
    if (resource === "retry-slack") {
      return reply({ slack: await deliverSlack(plan, true) });
    }
    return reply({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return reply({ error: "INVALID_INPUT" }, 400);
    const message = error instanceof Error ? error.message : "";
    const controlled = /^(PLAN_[A-Z_]+|SNAPSHOT_CHANGED|DESTINATION_NOT_ALLOWED|DUPLICATE_ACTION_ID|WRITES_DISABLED|SUBTASK_TYPE_NOT_CONFIGURED|JIRA_NOT_VERIFIED|RECIPIENT_CHANGED|RETRY_TOO_EARLY|REHEARSAL_DISABLED|RECONCILIATION_REQUIRED|CONCURRENT_EXECUTION)$/;
    if (controlled.test(message)) return reply({ error: message }, message === "PLAN_NOT_FOUND" ? 404 : 409);
    if (message.includes("already being executed")) return reply({ error: "CONCURRENT_EXECUTION" }, 409);
    return reply({ error: "SERVICE_UNAVAILABLE", message: "Revisá la configuración del servidor y los permisos del proveedor." }, 503);
  }
}
