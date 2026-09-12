// ─── GET|POST /api/workpilot/plans ───────────────────────────────────────────
// POST: agent saves a generated ActionPlan (called by P1 agent-core)
// GET:  frontend retrieves the active plan for a ticket (called by P2)

import { NextRequest, NextResponse } from "next/server"
import type { ActionPlan } from "../../../../../lib/server/../../../../../packages/agent-core/src/workpilot/action-plan"
import { storePlan, validatePlan } from "../../../../../lib/server/workpilot/plans"
import { getPlan, getAllPlansForIssue } from "../../../../../lib/server/workpilot/persistence"
import { createLogger } from "../../../../../lib/server/logger"

const log = createLogger("api/plans")

// ─── POST — save a new plan ───────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let plan: ActionPlan
  try {
    plan = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!plan.planId || !plan.issueKey || typeof plan.version !== "number") {
    return NextResponse.json(
      { error: "planId, issueKey, and version are required" },
      { status: 400 }
    )
  }

  storePlan(plan)
  log.info("plan saved", { planId: plan.planId, issueKey: plan.issueKey, version: plan.version })

  return NextResponse.json({ planId: plan.planId }, { status: 201 })
}

// ─── GET — retrieve active plan for a ticket ─────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const planId = searchParams.get("planId")
  const issueKey = searchParams.get("issueKey")

  if (planId) {
    const plan = getPlan(planId)
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(plan)
  }

  if (issueKey) {
    const plans = getAllPlansForIssue(issueKey)
    const active = plans
      .filter((p) => p.status === "pending")
      .sort((a, b) => b.version - a.version)[0]

    if (!active) return NextResponse.json({ error: "No active plan" }, { status: 404 })
    return NextResponse.json(active)
  }

  return NextResponse.json(
    { error: "Provide planId or issueKey" },
    { status: 400 }
  )
}
