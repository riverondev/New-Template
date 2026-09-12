// ─── Jira REST API client ─────────────────────────────────────────────────────
// Implements IJiraClient — use the interface everywhere so tests can inject mocks.
// Features: Basic Auth, retry with exponential backoff, rate-limit (429) handling,
// per-request timeout, structured logging.

import { loadEnv } from "../env"
import { createLogger, recordMetric } from "../logger"

const log = createLogger("jira/client")

// ─── Interface ────────────────────────────────────────────────────────────────
// All Jira modules depend on this interface, never on JiraClient directly.

export interface IJiraClient {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
  put<T>(path: string, body: unknown): Promise<T>
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export type JiraErrorCode =
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UNKNOWN"

export function statusToCode(status: number): JiraErrorCode {
  if (!status || status === 0) return "TIMEOUT"
  if (status === 429) return "RATE_LIMITED"
  if (status === 403) return "FORBIDDEN"
  if (status === 404) return "NOT_FOUND"
  if (status === 400) return "BAD_REQUEST"
  return "UNKNOWN"
}

export class JiraError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
    public readonly retryable: boolean,
    public readonly code?: JiraErrorCode
  ) {
    super(message)
    this.name = "JiraError"
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

type RetryConfig = {
  maxAttempts: number
  baseDelayMs: number
  timeoutMs: number
}

const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 300,
  timeoutMs: 10_000,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 503 || status === 502 || status === 504
}

// ─── Core fetch with retry ────────────────────────────────────────────────────

async function jiraFetch<T>(
  baseUrl: string,
  authHeader: string,
  method: string,
  path: string,
  body?: unknown,
  retry: RetryConfig = DEFAULT_RETRY
): Promise<T> {
  const url = `${baseUrl}/rest/api/3${path}`
  let lastError: JiraError | null = null

  for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
    const attemptStart = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), retry.timeoutMs)

    try {
      log.debug("jira fetch", { method, path, attempt })

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (res.ok) {
        // 204 No Content — return empty object
        if (res.status === 204) return {} as T
        const data = await res.json()
        const latency = Date.now() - attemptStart
        recordMetric("jira/client", "success", latency)
        log.debug("jira fetch ok", { method, path, status: res.status, latencyMs: latency })
        return data as T
      }

      // Rate limit — respect Retry-After header
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After") ?? "1")
        const delay = retryAfter * 1000
        const latency = Date.now() - attemptStart
        log.warn("jira rate limit", { path, attempt, retryAfterMs: delay })
        lastError = new JiraError(`Rate limited`, 429, path, true, statusToCode(429))
        recordMetric("jira/client", "failure", latency)
        if (attempt < retry.maxAttempts) {
          await sleep(delay)
          continue
        }
        throw lastError
      }

      const retryable = isRetryable(res.status)
      const text = await res.text().catch(() => "")
      const latency = Date.now() - attemptStart
      lastError = new JiraError(
        `Jira ${method} ${path} → ${res.status}: ${text}`,
        res.status,
        path,
        retryable,
        statusToCode(res.status)
      )

      log.warn("jira fetch error", {
        method,
        path,
        status: res.status,
        attempt,
        retryable,
        latencyMs: latency,
      })

      recordMetric("jira/client", "failure", latency)

      if (!retryable || attempt === retry.maxAttempts) throw lastError

      // Exponential backoff: 300ms, 600ms, 1200ms, ...
      await sleep(retry.baseDelayMs * 2 ** (attempt - 1))
    } catch (err) {
      clearTimeout(timer)
      const latency = Date.now() - attemptStart
      if ((err as Error).name === "AbortError") {
        lastError = new JiraError(`Timeout after ${retry.timeoutMs}ms`, 0, path, true, statusToCode(0))
        log.error("jira timeout", { method, path, attempt, timeoutMs: retry.timeoutMs })
        recordMetric("jira/client", "failure", latency)
        if (attempt < retry.maxAttempts) {
          await sleep(retry.baseDelayMs * 2 ** (attempt - 1))
          continue
        }
        throw lastError
      }

      if (err instanceof JiraError) throw err
      recordMetric("jira/client", "failure", latency)
      throw err
    }
  }

  throw lastError!
}

// ─── JiraClient ───────────────────────────────────────────────────────────────

export class JiraClient implements IJiraClient {
  private readonly baseUrl: string
  private readonly authHeader: string

  constructor() {
    const env = loadEnv()
    this.baseUrl = env.jira.baseUrl
    const credentials = Buffer.from(
      `${env.jira.email}:${env.jira.apiToken}`
    ).toString("base64")
    this.authHeader = `Basic ${credentials}`
  }

  get<T>(path: string): Promise<T> {
    return jiraFetch<T>(this.baseUrl, this.authHeader, "GET", path)
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return jiraFetch<T>(this.baseUrl, this.authHeader, "POST", path, body)
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return jiraFetch<T>(this.baseUrl, this.authHeader, "PUT", path, body)
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
// One instance per server process. Tests inject a mock via IJiraClient.

let _client: IJiraClient | null = null

export function getJiraClient(): IJiraClient {
  if (!_client) _client = new JiraClient()
  return _client
}

// For tests: replace the singleton with a mock
export function setJiraClient(client: IJiraClient): void {
  _client = client
}
