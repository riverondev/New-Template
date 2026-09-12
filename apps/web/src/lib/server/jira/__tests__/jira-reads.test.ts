// ─── Unit tests: Jira read modules ───────────────────────────────────────────

import { getIssue, getSubtasks } from "../issues"
import { getIssueComments } from "../comments"
import { getRelatedIssues } from "../relations"
import { MockJiraClient } from "./mock-client"

// ─── getIssue ─────────────────────────────────────────────────────────────────

describe("getIssue", () => {
  test("maps raw Jira response to IssueFields", async () => {
    const mock = new MockJiraClient().onGet(
      "/issue/WP-42?fields=summary,status,priority,assignee,updated,subtasks",
      {
        key: "WP-42",
        fields: {
          summary: "Checkout validation blocked",
          status: { name: "In Progress" },
          priority: { name: "High" },
          assignee: { displayName: "Carlos" },
          updated: "2026-09-12T10:00:00.000Z",
          subtasks: [],
        },
      }
    )

    const result = await getIssue("WP-42", mock)
    expect(result.issueKey).toBe("WP-42")
    expect(result.summary).toBe("Checkout validation blocked")
    expect(result.status).toBe("In Progress")
    expect(result.priority).toBe("High")
    expect(result.assignee).toBe("Carlos")
  })

  test("handles missing assignee", async () => {
    const mock = new MockJiraClient().onGet(
      "/issue/WP-42?fields=summary,status,priority,assignee,updated,subtasks",
      {
        key: "WP-42",
        fields: {
          summary: "Test",
          status: { name: "Open" },
          priority: { name: "Medium" },
          assignee: null,
          updated: "2026-09-12T10:00:00.000Z",
          subtasks: [],
        },
      }
    )

    const result = await getIssue("WP-42", mock)
    expect(result.assignee).toBeUndefined()
  })
})

// ─── getSubtasks ──────────────────────────────────────────────────────────────

describe("getSubtasks", () => {
  test("returns mapped subtasks", async () => {
    const mock = new MockJiraClient().onGet(
      "/issue/WP-42?fields=subtasks",
      {
        key: "WP-42",
        fields: {
          subtasks: [
            { key: "WP-43", fields: { summary: "Implement fix", status: { name: "Done" } } },
          ],
        },
      }
    )

    const result = await getSubtasks("WP-42", mock)
    expect(result).toHaveLength(1)
    expect(result[0].issueKey).toBe("WP-43")
    expect(result[0].status).toBe("Done")
  })

  test("returns empty array when no subtasks", async () => {
    const mock = new MockJiraClient().onGet(
      "/issue/WP-42?fields=subtasks",
      { key: "WP-42", fields: { subtasks: [] } }
    )
    const result = await getSubtasks("WP-42", mock)
    expect(result).toHaveLength(0)
  })
})

// ─── getIssueComments ─────────────────────────────────────────────────────────

describe("getIssueComments", () => {
  test("maps ADF body to plain text", async () => {
    const mock = new MockJiraClient().onGet(
      "/issue/WP-42/comment?maxResults=100&orderBy=created",
      {
        comments: [
          {
            id: "c-001",
            author: { displayName: "Ana" },
            body: {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Fix is in staging" }],
                },
              ],
            },
            created: "2026-09-11T09:00:00.000Z",
          },
        ],
        total: 1,
      }
    )

    const result = await getIssueComments("WP-42", mock)
    expect(result).toHaveLength(1)
    expect(result[0].body).toBe("Fix is in staging")
    expect(result[0].author).toBe("Ana")
  })

  test("handles plain string body", async () => {
    const mock = new MockJiraClient().onGet(
      "/issue/WP-42/comment?maxResults=100&orderBy=created",
      {
        comments: [
          {
            id: "c-002",
            author: { displayName: "Bob" },
            body: "Simple text comment",
            created: "2026-09-11T10:00:00.000Z",
          },
        ],
        total: 1,
      }
    )

    const result = await getIssueComments("WP-42", mock)
    expect(result[0].body).toBe("Simple text comment")
  })
})

// ─── getRelatedIssues ─────────────────────────────────────────────────────────

describe("getRelatedIssues", () => {
  test("maps outward and inward links", async () => {
    const mock = new MockJiraClient().onGet(
      "/issue/WP-42?fields=issuelinks",
      {
        fields: {
          issuelinks: [
            {
              type: { inward: "is blocked by", outward: "blocks" },
              outwardIssue: {
                key: "WP-39",
                fields: { summary: "Auth service", status: { name: "Open" } },
              },
            },
          ],
        },
      }
    )

    const result = await getRelatedIssues("WP-42", mock)
    expect(result).toHaveLength(1)
    expect(result[0].issueKey).toBe("WP-39")
    expect(result[0].linkType).toBe("blocks")
  })
})
