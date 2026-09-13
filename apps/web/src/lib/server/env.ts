// ─── Environment validation ───────────────────────────────────────────────────
// Called once at server startup. Throws if required vars are missing.
// Add every new required env var here — never read process.env directly elsewhere.
//
// SECURITY: never log the resolved AppEnv object — it contains apiToken.
// Use env.jira.baseUrl / env.jira.projectKey for logging; never email or token.

export type JiraEnv = {
  baseUrl: string
  email: string
  apiToken: string
  projectKey: string
}

export type AppEnv = {
  jira: JiraEnv
  planTtlMinutes: number
  writesEnabled: boolean // feature flag — false = all actions are dry-run
}

// Cached after first successful load — avoids re-reading process.env on every request
let _cached: AppEnv | null = null

export function loadEnv(): AppEnv {
  const hasRealJiraConfig = Boolean(
    process.env.JIRA_BASE_URL ||
    process.env.JIRA_EMAIL ||
    process.env.JIRA_API_TOKEN ||
    process.env.JIRA_PROJECT_KEY,
  )

  if (process.env.WORKPILOT_DEMO === "true" || !hasRealJiraConfig) return {
    jira: { baseUrl: "https://rehearsal.invalid", email: "", apiToken: "", projectKey: "WP" },
    planTtlMinutes: 30, writesEnabled: true,
  }
  if (_cached) return _cached

  const required = [
    "JIRA_BASE_URL",
    "JIRA_EMAIL",
    "JIRA_API_TOKEN",
    "JIRA_PROJECT_KEY",
  ] as const

  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(
      `[workpilot] Missing required environment variables: ${missing.join(", ")}\n` +
      `See .env.example for the full list and required Jira permissions.`
    )
  }

  const planTtl = Number(process.env.PLAN_TTL_MINUTES ?? "30")
  if (isNaN(planTtl) || planTtl < 1 || planTtl > 1440) {
    throw new Error(`[workpilot] PLAN_TTL_MINUTES must be a number between 1 and 1440, got: ${process.env.PLAN_TTL_MINUTES}`)
  }

  _cached = {
    jira: {
      baseUrl: process.env.JIRA_BASE_URL!.replace(/\/$/, ""),
      email: process.env.JIRA_EMAIL!,
      apiToken: process.env.JIRA_API_TOKEN!,
      projectKey: process.env.JIRA_PROJECT_KEY!,
    },
    planTtlMinutes: planTtl,
    writesEnabled: process.env.JIRA_WRITES_ENABLED === "true",
  }
  return _cached
}

// For tests: reset the cache so each test can inject its own env
export function resetEnvCache(): void {
  _cached = null
}
