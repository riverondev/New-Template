// ─── Jira issue relations reads ───────────────────────────────────────────────

import type { RelatedIssue } from "agent-core/workpilot/action-plan"
import { getJiraClient, type IJiraClient } from "./client"
import { createLogger } from "../logger"

const log = createLogger("jira/relations")

type RawLink = {
  type: { inward: string; outward: string }
  inwardIssue?: { key: string; fields: { summary: string; status: { name: string } } }
  outwardIssue?: { key: string; fields: { summary: string; status: { name: string } } }
}

type RawIssueLinks = {
  fields: { issuelinks: RawLink[] }
}

export async function getRelatedIssues(
  issueKey: string,
  client: IJiraClient = getJiraClient()
): Promise<RelatedIssue[]> {
  log.info("get related issues", { issueKey })

  const raw = await client.get<RawIssueLinks>(
    `/issue/${issueKey}?fields=issuelinks`
  )

  const links = raw.fields.issuelinks ?? []
  const result: RelatedIssue[] = []

  for (const link of links) {
    if (link.outwardIssue) {
      result.push({
        issueKey: link.outwardIssue.key,
        summary: link.outwardIssue.fields.summary,
        status: link.outwardIssue.fields.status.name,
        linkType: link.type.outward,
      })
    }
    if (link.inwardIssue) {
      result.push({
        issueKey: link.inwardIssue.key,
        summary: link.inwardIssue.fields.summary,
        status: link.inwardIssue.fields.status.name,
        linkType: link.type.inward,
      })
    }
  }

  return result
}
