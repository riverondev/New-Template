// ─── Jira comments reads ──────────────────────────────────────────────────────

import type { Comment } from "../../../../packages/agent-core/src/workpilot/action-plan"
import { getJiraClient, type IJiraClient } from "./client"
import { createLogger } from "../logger"

const log = createLogger("jira/comments")

type RawComment = {
  id: string
  author: { displayName: string }
  body: unknown // Jira v3 returns Atlassian Document Format (ADF) or string
  created: string
}

type RawCommentsResponse = {
  comments: RawComment[]
  total: number
}

function extractText(body: unknown): string {
  if (typeof body === "string") return body
  // ADF: { type: "doc", content: [...] } — extract plain text recursively
  if (typeof body === "object" && body !== null) {
    const node = body as Record<string, unknown>
    if (node["type"] === "text" && typeof node["text"] === "string") {
      return node["text"]
    }
    if (Array.isArray(node["content"])) {
      return (node["content"] as unknown[]).map(extractText).join("")
    }
  }
  return ""
}

export async function getIssueComments(
  issueKey: string,
  client: IJiraClient = getJiraClient()
): Promise<Comment[]> {
  log.info("get comments", { issueKey })

  const raw = await client.get<RawCommentsResponse>(
    `/issue/${issueKey}/comment?maxResults=100&orderBy=created`
  )

  return raw.comments.map((c) => ({
    id: c.id,
    author: c.author.displayName,
    body: extractText(c.body),
    created: c.created,
  }))
}
