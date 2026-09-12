// ─── Jira issue reads ─────────────────────────────────────────────────────────

import type { Subtask } from "../../../../packages/agent-core/src/workpilot/action-plan"
import { getJiraClient, type IJiraClient } from "./client"
import { createLogger } from "../logger"

const log = createLogger("jira/issues")

// ─── Raw Jira shapes (partial) ────────────────────────────────────────────────

type RawIssue = {
  key: string
  fields: {
    summary: string
    status: { name: string }
    priority: { name: string }
    assignee?: { displayName: string; emailAddress?: string }
    updated: string
    subtasks?: Array<{
      key: string
      fields: { summary: string; status: { name: string } }
    }>
  }
}

// ─── Mapped types ─────────────────────────────────────────────────────────────

export type IssueFields = {
  issueKey: string
  summary: string
  status: string
  priority: string
  assignee?: string
  updatedAt: string
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getIssue(
  issueKey: string,
  client: IJiraClient = getJiraClient()
): Promise<IssueFields> {
  log.info("get issue", { issueKey })

  const raw = await client.get<RawIssue>(
    `/issue/${issueKey}?fields=summary,status,priority,assignee,updated,subtasks`
  )

  return {
    issueKey: raw.key,
    summary: raw.fields.summary,
    status: raw.fields.status.name,
    priority: raw.fields.priority.name,
    assignee: raw.fields.assignee?.displayName,
    updatedAt: raw.fields.updated,
  }
}

export async function getSubtasks(
  issueKey: string,
  client: IJiraClient = getJiraClient()
): Promise<Subtask[]> {
  log.info("get subtasks", { issueKey })

  const raw = await client.get<RawIssue>(
    `/issue/${issueKey}?fields=subtasks`
  )

  return (raw.fields.subtasks ?? []).map((s) => ({
    issueKey: s.key,
    summary: s.fields.summary,
    status: s.fields.status.name,
  }))
}
