// Deterministic P4 QA fixtures, NOT agent output. Never calls external providers.
import { randomUUID } from "node:crypto";
import type { IJiraClient } from "../jira/client";
import type { SlackClient } from "../slack/client";
import { readRecord, writeRecord } from "./disk";
import type { ActionPlan, WorkContext } from "agent-core/workpilot/action-plan";
type Fixture = { key: string; fields: {
  summary: string; status: { name: string }; priority: { name: string };
  assignee: { displayName: string; accountId: string } | null; updated: string;
  parent?: { key: string }; description?: unknown;
  subtasks: Array<{ key: string; fields: { summary: string; status: { name: string } } }>;
  issuelinks: Array<{ type: { inward: string; outward: string }; outwardIssue: {
    key: string; fields: { summary: string; status: { name: string } } } }>;
}; comments: Array<{ id: string; author: { displayName: string }; body: unknown; created: string }> };
function fixture(key: string): Fixture {
  const saved = readRecord<Fixture>("fixture-jira", key);
  if (saved) return saved;
  if (!["WP-42", "WP-57"].includes(key)) throw new Error("FIXTURE_NOT_FOUND");
  const blocked = key === "WP-42";
  return { key, fields: {
    summary: blocked ? "Validación de checkout bloqueada" : "Revisión de accesibilidad lista para QA",
    status: { name: blocked ? "Blocked" : "Ready for QA" }, priority: { name: blocked ? "High" : "Medium" },
    assignee: { displayName: "Demo QA", accountId: "demo-qa" }, updated: "2026-09-12T10:00:00.000Z",
    description: blocked ? "Arreglo en staging; falta caso de prueba." : "Preparar resumen de traspaso.",
    subtasks: blocked ? [{ key: "WP-43", fields: { summary: "Implementar fix", status: { name: "Done" } } }] : [],
    issuelinks: blocked ? [{ type: { inward: "blocks", outward: "is blocked by" },
      outwardIssue: { key: "WP-39", fields: { summary: "Dependencia checkout", status: { name: "Open" } } } }] : [],
  }, comments: [{ id: "fixture-comment", author: { displayName: "Demo" },
    body: blocked ? "El fix está en staging; falta documentar el caso de prueba." : "Dependencias cerradas; falta resumen de handoff.",
    created: "2026-09-12T10:00:00.000Z" }] };
}
function save(issue: Fixture) {
  issue.fields.updated = new Date().toISOString();
  writeRecord("fixture-jira", issue.key, issue);
}
export const rehearsalJira: IJiraClient = {
  async get<T>(path: string): Promise<T> {
    const key = path.match(/^\/issue\/([A-Z]+-\d+)/)?.[1];
    if (!key) throw new Error("FIXTURE_ROUTE_NOT_FOUND");
    const issue = fixture(key);
    if (path.includes("/comment")) return { comments: issue.comments, total: issue.comments.length } as T;
    return issue as T;
  },
  async post<T>(path: string, raw: unknown): Promise<T> {
    const body = raw as { body?: unknown; fields?: Fixture["fields"] & { parent: { key: string }; summary: string } };
    if (path.endsWith("/comment")) {
      const issue = fixture(path.split("/")[2]);
      const id = randomUUID();
      issue.comments.push({ id, author: { displayName: "WorkPilot rehearsal" }, body: body.body, created: new Date().toISOString() });
      save(issue); return { id } as T;
    }
    if (path === "/issue" && body.fields) {
      const fields = body.fields;
      const parent = fixture(fields.parent.key);
      const key = "WP-" + (100000 + Math.floor(Math.random() * 900000));
      const child: Fixture = { key, fields: { ...parent.fields, ...fields, status: { name: "Open" },
        subtasks: [], issuelinks: [] }, comments: [] };
      save(child);
      parent.fields.subtasks.push({ key, fields: { summary: fields.summary, status: { name: "Open" } } });
      save(parent); return { key } as T;
    }
    throw new Error("FIXTURE_ROUTE_NOT_FOUND");
  },
  async put<T>(path: string, raw: unknown): Promise<T> {
    const issue = fixture(path.split("/")[2]);
    const body = raw as { accountId?: string; fields?: { priority: { name: string } } };
    if (path.endsWith("/assignee")) issue.fields.assignee = { displayName: body.accountId!, accountId: body.accountId! };
    else if (body.fields?.priority) issue.fields.priority = body.fields.priority;
    else throw new Error("FIXTURE_ROUTE_NOT_FOUND");
    save(issue); return {} as T;
  },
};
export const rehearsalSlack: SlackClient = {
  async postMessage({ recipientUserId, text }) {
    const messageTs = Date.now() + ".000001";
    const receipt = { provider: "slack" as const, providerId: "DREHEARSAL:" + messageTs,
      conversationId: "DREHEARSAL", messageTs, recipientUserId };
    writeRecord("fixture-slack", messageTs, { ...receipt, text });
    return receipt;
  },
};
export function rehearsalPlan(context: WorkContext): ActionPlan {
  if (process.env.WORKPILOT_DEMO !== "true") throw new Error("REHEARSAL_DISABLED");
  const blocked = context.issueKey === "WP-42";
  const body = blocked ? "Ensayo: fix en staging. Falta documentar el caso de prueba y resolver WP-39." :
    "Ensayo: accesibilidad lista para QA. Dependencias cerradas; revisar handoff.";
  const alreadyCreated = context.existingSubtasks.some(s => s.summary === "Documentar caso de prueba QA");
  const commentId = context.comments[0]?.id ?? "fixture-comment";
  const evidenceId = `comment:${context.issueKey}:${commentId}`;
  const issueEvidenceId = `issue:${context.issueKey}`;
  return {
    planId: randomUUID(), version: 1, issueKey: context.issueKey, snapshotVersion: context.snapshotVersion,
    snapshotHash: context.snapshotHash,
    evidence: [
      { evidenceId: issueEvidenceId, sourceType: "issue", issueKey: context.issueKey,
        excerpt: context.summary ?? context.issueKey },
      { evidenceId, sourceType: "comment", issueKey: context.issueKey,
        commentId, excerpt: context.comments[0]?.body?.slice(0, 280) ?? body },
    ],
    findings: [{ statementId: "f1", text: context.comments[0]?.body ?? body, evidenceRefs: [evidenceId] }],
    hypotheses: [],
    missingInfo: blocked
      ? [
          { missingInfoId: "m1", text: "Caso de prueba QA", blocking: true, evidenceRefs: [evidenceId] },
          { missingInfoId: "m2", text: "Resolver WP-39", blocking: false, evidenceRefs: [issueEvidenceId] },
        ]
      : [],
    actions: [
      { actionId: "handoff", type: "add_comment",
        payload: { issueKey: context.issueKey, body },
        after: { body }, evidenceRefs: [evidenceId], status: "pending" },
      ...(blocked && !alreadyCreated ? [{ actionId: "qa", type: "create_subtask" as const,
        payload: { parentKey: context.issueKey, summary: "Documentar caso de prueba QA" },
        after: { summary: "Documentar caso de prueba QA" }, evidenceRefs: [evidenceId], status: "pending" as const }] : []),
    ],
    slackDraft: { channel: "", text: context.issueKey + " — " + body },
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), status: "pending",
  };
}
