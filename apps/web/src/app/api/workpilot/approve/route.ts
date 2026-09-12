// ─── POST /api/workpilot/approve ──────────────────────────────────────────────
// The only server endpoint that triggers Jira writes.
// Security layers: session check → RBAC → throttle → executor.

import { NextRequest, NextResponse } from "next/server"
import type { ApprovalRequest } from "../../../../../lib/server/../../../../../packages/agent-core/src/workpilot/action-plan"
import { executeApproval } from "../../../../../lib/server/workpilot/executor"
import { createLogger } from "../../../../../lib/server/logger"

const log = createLogger("api/approve")

// ─── Simple in-memory throttle ────────────────────────────────────────────────
// Allows max 5 approval requests per IP per minute.
// Replace with Redis-backed rate limiter in production.

const throttleMap = new Map<string, { count: number; resetAt: number }>()
const THROTTLE_LIMIT = 5
const THROTTLE_WINDOW_MS = 60_000

function isThrottled(ip: string): boolean {
  const now = Date.now()
  const entry = throttleMap.get(ip)

  if (!entry || now > entry.resetAt) {
    throttleMap.set(ip, { count: 1, resetAt: now + THROTTLE_WINDOW_MS })
    return false
  }

  if (entry.count >= THROTTLE_LIMIT) return true

  entry.count++
  return false
}

// ─── Session validation ───────────────────────────────────────────────────────
// Minimal check — replace with your auth provider (NextAuth, Clerk, etc.)

function getSessionUser(req: NextRequest): string | null {
  // In production: verify JWT / session cookie here
  // For MVP: accept a header set by the frontend after login
  const userId = req.headers.get("x-workpilot-user")
  return userId ?? null
}

// ─── RBAC ─────────────────────────────────────────────────────────────────────
// For MVP: any authenticated user can approve.
// Extend this to check roles/permissions as needed.

function canApprove(_userId: string): boolean {
  return true
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown"

  // Throttle
  if (isThrottled(ip)) {
    log.warn("throttled", { ip })
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  // Session
  const userId = getSessionUser(req)
  if (!userId) {
    log.warn("unauthenticated approval attempt", { ip })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // RBAC
  if (!canApprove(userId)) {
    log.warn("forbidden approval attempt", { userId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Parse body
  let body: ApprovalRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.planId || typeof body.version !== "number") {
    return NextResponse.json(
      { error: "planId and version are required" },
      { status: 400 }
    )
  }

  log.info("approval request", { userId, planId: body.planId, version: body.version, dryRun: body.dryRun })

  try {
    const result = await executeApproval(body)
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    const message = (err as Error).message

    const clientErrors = [
      "PLAN_NOT_FOUND",
      "PLAN_EXPIRED",
      "PLAN_WRONG_VERSION",
      "PLAN_NOT_PENDING",
      "SNAPSHOT_CHANGED",
    ]

    if (clientErrors.includes(message)) {
      log.warn("approval rejected", { planId: body.planId, reason: message })
      return NextResponse.json({ error: message }, { status: 409 })
    }

    if (message.includes("already being executed")) {
      return NextResponse.json({ error: "CONCURRENT_EXECUTION" }, { status: 409 })
    }

    log.error("approval error", { planId: body.planId, error: message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
