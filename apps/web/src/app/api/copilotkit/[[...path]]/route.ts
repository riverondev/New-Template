/**
 * The web surface's runtime endpoint.
 *
 * A Hono app built at module scope; Next.js route handlers are fetch-based, so
 * `app.fetch` is the handler. The catch-all segment lets Hono route the
 * runtime's sub-paths itself.
 *
 * ONE THING TO NOT DO HERE:
 *
 * Do NOT reuse one agent instance across requests. The factory form hands
 *    out a fresh agent per resolution.
 */
import { randomUUID } from "node:crypto";
import {
  CopilotRuntime,
  createCopilotHonoHandler,
} from "@copilotkit/runtime/v2";
import { makeAgent } from "agent-core";
import { SURFACE_RULES } from "agent-core/shared";
import { WORKPILOT_ROLE } from "agent-core/workpilot";
const prompt = `${SURFACE_RULES}\n\n${WORKPILOT_ROLE}\n\nWeb workflow: At the start of EVERY user request call workpilot_read_context for the selected issueKey. It returns fresh Jira context, canonical evidence IDs, persisted plan and execution/Slack status. Use those results, never stale chat memory. If the read fails, report the error and stop. For a proposal, call workpilot_propose with issueKey, the EXACT snapshotHash returned by that read, reasoning, proposedActions, and optional slackText. Do not generate a full ActionPlan or metadata: the server builds it and applies policy. Evidence references must use returned IDs. A tool response can reject unsafe actions: explain the returned missing information and do not claim rejected actions are proposed. Empty actions are valid. For follow-up questions read context and execution again; you may answer without proposing new writes. Never call approval or Slack tools. Chat consent does not execute. After creating a proposal tell the user to review the page. In rehearsal mode clearly label simulated Jira/Slack; analysis still uses the configured model. Do not invent assignment candidates. When Jira provides none, report missing ownership instead of assigning.`;

// Web writes use /api/followups after a browser approval. Never expose raw MCP writes here.
const runtime = new CopilotRuntime({
  agents: () => ({ default: makeAgent(randomUUID(), { workplace: false, prompt }) }),
});

const app = createCopilotHonoHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = app.fetch;
export const POST = app.fetch;
export const OPTIONS = app.fetch;
