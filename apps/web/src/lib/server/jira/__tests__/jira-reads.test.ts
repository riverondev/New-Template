import assert from "node:assert/strict";
import { describe, test } from "node:test";
// ─── Unit tests: Jira read modules ───────────────────────────────────────────

import { getIssue, getSubtasks } from "../issues"
import { getIssueComments } from "../comments"
import { getRelatedIssues } from "../relations"
import { MockJiraClient } from "./mock-client"

// ─── getIssue ─────────────────────────────────────────────────────────────────

describe("getIssue", () => {
  test("maps raw Jira response to IssueFields", async () => {
    const mock = new MockJiraClient().onGet(
      "/issue/WP-42?fields=summary,status,priority,assignee,updated,subtasks,parent,description",
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
    assert.equal(result.issueKey, "WP-42")
    assert.equal(result.summary, "Checkout validation blocked")
    assert.equal(result.status, "In Progress")
    assert.equal(result.priority, "High")
    assert.equal(result.assignee, "Carlos")
  })

  test("handles missing assignee", async () => {
    const mock = new MockJiraClient().onGet(
      "/issue/WP-42?fields=summary,status,priority,assignee,updated,subtasks,parent,description",
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
    assert.equal(result.assignee, undefined)
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
    assert.equal(result.length, 1)
    assert.equal(result[0].issueKey, "WP-43")
    assert.equal(result[0].status, "Done")
  })

  test("returns empty array when no subtasks", async () => {
    const mock = new MockJiraClient().onGet(
      "/issue/WP-42?fields=subtasks",
      { key: "WP-42", fields: { subtasks: [] } }
    )
    const result = await getSubtasks("WP-42", mock)
    assert.equal(result.length, 0)
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
    assert.equal(result.length, 1)
    assert.equal(result[0].body, "Fix is in staging")
    assert.equal(result[0].author, "Ana")
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
    assert.equal(result[0].body, "Simple text comment")
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
    assert.equal(result.length, 1)
    assert.equal(result[0].issueKey, "WP-39")
    assert.equal(result[0].linkType, "blocks")
  })
})
