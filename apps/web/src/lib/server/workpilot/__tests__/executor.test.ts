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
import type { ActionPlan, WorkContext } from "../../../../../../packages/agent-core/src/workpilot/action-plan"

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
    findings: ["Checkout validation is blocked"],
    hypotheses: [],
    missingInfo: ["Test case not documented"],
    actions: [],
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
    expect(idempotencyKey("plan-1", 2, "action-3")).toBe("plan-1:2:action-3")
  })

  test("hasExecuted returns false before marking", () => {
    expect(hasExecuted("plan-x:1:action-y")).toBe(false)
  })

  test("hasExecuted returns true after marking", () => {
    const key = idempotencyKey("plan-idem", 1, "action-a")
    markExecuted(key, "exec-001")
    expect(hasExecuted(key)).toBe(true)
  })

  test("plan lock prevents concurrent execution", async () => {
    const acquired = acquirePlanLock("plan-lock-test")
    expect(acquired).toBe(true)
    const second = acquirePlanLock("plan-lock-test")
    expect(second).toBe(false)
    releasePlanLock("plan-lock-test")
    const third = acquirePlanLock("plan-lock-test")
    expect(third).toBe(true)
    releasePlanLock("plan-lock-test")
  })

  test("withPlanLock releases lock even on error", async () => {
    await expect(
      withPlanLock("plan-err", async () => {
        throw new Error("boom")
      })
    ).rejects.toThrow("boom")
    // Lock should be released — can acquire again
    expect(acquirePlanLock("plan-err")).toBe(true)
    releasePlanLock("plan-err")
  })
})

// ─── Snapshot hash tests ──────────────────────────────────────────────────────

describe("computeSnapshotHash", () => {
  test("same context produces same hash", () => {
    const ctx = makeContext()
    expect(computeSnapshotHash(ctx)).toBe(computeSnapshotHash(ctx))
  })

  test("different priority produces different hash", () => {
    const a = makeContext({ priority: "High" })
    const b = makeContext({ priority: "Highest" })
    expect(computeSnapshotHash(a)).not.toBe(computeSnapshotHash(b))
  })

  test("different assignee produces different hash", () => {
    const a = makeContext({ assignee: "carlos" })
    const b = makeContext({ assignee: "ana" })
    expect(computeSnapshotHash(a)).not.toBe(computeSnapshotHash(b))
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
    expect(computeSnapshotHash(a)).toBe(computeSnapshotHash(b))
  })
})

// ─── Plan validation tests ────────────────────────────────────────────────────

describe("validatePlan", () => {
  test("valid plan passes", () => {
    const plan = makePlan()
    savePlan(plan)
    const result = validatePlan(plan.planId, plan.version, plan.snapshotHash)
    expect(result.ok).toBe(true)
  })

  test("PLAN_NOT_FOUND for unknown planId", () => {
    const result = validatePlan("nonexistent", 1, "hash")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("PLAN_NOT_FOUND")
  })

  test("PLAN_WRONG_VERSION for stale version", () => {
    const plan = makePlan({ planId: "plan-version-test", version: 3 })
    savePlan(plan)
    const result = validatePlan("plan-version-test", 2, plan.snapshotHash)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("PLAN_WRONG_VERSION")
  })

  test("PLAN_EXPIRED for past expiresAt", () => {
    const plan = makePlan({
      planId: "plan-expired",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    savePlan(plan)
    const result = validatePlan("plan-expired", plan.version, plan.snapshotHash)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("PLAN_EXPIRED")
  })

  test("SNAPSHOT_CHANGED when Jira changed", () => {
    const plan = makePlan({ planId: "plan-snapshot" })
    savePlan(plan)
    const result = validatePlan("plan-snapshot", plan.version, "different-hash")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("SNAPSHOT_CHANGED")
  })

  test("PLAN_NOT_PENDING for already executed plan", () => {
    const plan = makePlan({ planId: "plan-executed", status: "executed" })
    savePlan(plan)
    const result = validatePlan("plan-executed", plan.version, plan.snapshotHash)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("PLAN_NOT_PENDING")
  })
})
