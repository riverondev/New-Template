import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
const testDirectory = mkdtempSync(join(tmpdir(), "workpilot-unit-"));
process.env.WORKPILOT_DATA_DIR = testDirectory;
process.env.WORKPILOT_DEMO = "true";
process.env.JIRA_PROJECT_KEY = "WP";
after(() => rmSync(testDirectory, { recursive: true, force: true }));
// ─── Unit tests: idempotency, plans, executor (dry-run) ──────────────────────
// Run with: npx jest (or vitest) from apps/web
// No live Jira calls — all Jira reads use MockJiraClient.

import {
  idempotencyKey,
  hasExecuted,
  markExecuted,
  acquirePlanLock,
  releasePlanLock,
  withPlanLock,
} from "../idempotency"
import { computeSnapshotHash, storePlan, validatePlan } from "../plans"
import { savePlan, getPlan } from "../persistence"
import type { ActionPlan, WorkContext } from "agent-core/workpilot/action-plan"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<WorkContext> = {}): WorkContext {
  return {
    issueKey: "WP-42",
    summary: "Test issue",
    status: "In Progress",
    priority: "High",
    assignee: "carlos",
    comments: [],
    relatedIssues: [],
    existingSubtasks: [],
    snapshotVersion: "2026-09-12T10:00:00.000Z",
    snapshotHash: "",
    fetchedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makePlan(overrides: Partial<ActionPlan> = {}): ActionPlan {
  const ctx = makeContext()
  const hash = computeSnapshotHash(ctx)
  return {
    planId: "plan-001",
    version: 1,
    issueKey: "WP-42",
    snapshotVersion: ctx.snapshotVersion,
    snapshotHash: hash,
    findings: [{ statementId: "f1", text: "Checkout validation is blocked", evidenceRefs: [] }],
    hypotheses: [],
    missingInfo: [{ missingInfoId: "m1", text: "Test case not documented", blocking: true, evidenceRefs: [] }],
    actions: [],
    evidence: [],
    slackDraft: { channel: "#dev", text: "WP-42 ready for handoff" },
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    status: "pending",
    ...overrides,
  }
}

// ─── Idempotency tests ────────────────────────────────────────────────────────

describe("idempotency", () => {
  test("key format is planId:version:actionId", () => {
    assert.equal(idempotencyKey("plan-1", 2, "action-3"), "plan-1:2:action-3")
  })

  test("hasExecuted returns false before marking", () => {
    assert.equal(hasExecuted("plan-x:1:action-y"), false)
  })

  test("hasExecuted returns true after marking", () => {
    const key = idempotencyKey("plan-idem", 1, "action-a")
    markExecuted(key, "exec-001")
    assert.equal(hasExecuted(key), true)
  })

  test("plan lock prevents concurrent execution", async () => {
    const acquired = acquirePlanLock("plan-lock-test")
    assert.equal(acquired, true)
    const second = acquirePlanLock("plan-lock-test")
    assert.equal(second, false)
    releasePlanLock("plan-lock-test")
    const third = acquirePlanLock("plan-lock-test")
    assert.equal(third, true)
    releasePlanLock("plan-lock-test")
  })

  test("withPlanLock releases lock even on error", async () => {
    await assert.rejects(
      withPlanLock("plan-err", async () => {
        throw new Error("boom")
      })
    , /boom/)
    // Lock should be released — can acquire again
    assert.equal(acquirePlanLock("plan-err"), true)
    releasePlanLock("plan-err")
  })
})

// ─── Snapshot hash tests ──────────────────────────────────────────────────────

describe("computeSnapshotHash", () => {
  test("same context produces same hash", () => {
    const ctx = makeContext()
    assert.equal(computeSnapshotHash(ctx), computeSnapshotHash(ctx))
  })

  test("different priority produces different hash", () => {
    const a = makeContext({ priority: "High" })
    const b = makeContext({ priority: "Highest" })
    assert.notEqual(computeSnapshotHash(a), computeSnapshotHash(b))
  })

  test("different assignee produces different hash", () => {
    const a = makeContext({ assignee: "carlos" })
    const b = makeContext({ assignee: "ana" })
    assert.notEqual(computeSnapshotHash(a), computeSnapshotHash(b))
  })

  test("subtask order does not affect hash", () => {
    const a = makeContext({
      existingSubtasks: [
        { issueKey: "WP-43", summary: "A", status: "Done" },
        { issueKey: "WP-44", summary: "B", status: "Done" },
      ],
    })
    const b = makeContext({
      existingSubtasks: [
        { issueKey: "WP-44", summary: "B", status: "Done" },
        { issueKey: "WP-43", summary: "A", status: "Done" },
      ],
    })
    assert.equal(computeSnapshotHash(a), computeSnapshotHash(b))
  })
})

// ─── Plan validation tests ────────────────────────────────────────────────────

describe("validatePlan", () => {
  test("valid plan passes", () => {
    const plan = makePlan()
    savePlan(plan)
    const result = validatePlan(plan.planId, plan.version, plan.snapshotHash)
    assert.equal(result.ok, true)
  })

  test("PLAN_NOT_FOUND for unknown planId", () => {
    const result = validatePlan("nonexistent", 1, "hash")
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, "PLAN_NOT_FOUND")
  })

  test("PLAN_WRONG_VERSION for stale version", () => {
    const plan = makePlan({ planId: "plan-version-test", version: 3 })
    savePlan(plan)
    const result = validatePlan("plan-version-test", 2, plan.snapshotHash)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, "PLAN_WRONG_VERSION")
  })

  test("PLAN_EXPIRED for past expiresAt", () => {
    const plan = makePlan({
      planId: "plan-expired",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    savePlan(plan)
    const result = validatePlan("plan-expired", plan.version, plan.snapshotHash)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, "PLAN_EXPIRED")
  })

  test("SNAPSHOT_CHANGED when Jira changed", () => {
    const plan = makePlan({ planId: "plan-snapshot" })
    savePlan(plan)
    const result = validatePlan("plan-snapshot", plan.version, "different-hash")
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, "SNAPSHOT_CHANGED")
  })

  test("PLAN_NOT_PENDING for already executed plan", () => {
    const plan = makePlan({ planId: "plan-executed", status: "executed" })
    savePlan(plan)
    const result = validatePlan("plan-executed", plan.version, plan.snapshotHash)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, "PLAN_NOT_PENDING")
  })
})
