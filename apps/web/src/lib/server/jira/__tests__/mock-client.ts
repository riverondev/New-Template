// ─── Jira client mock ─────────────────────────────────────────────────────────
// Implements IJiraClient for unit tests. Configure responses per path.

import type { IJiraClient } from "../client"

type MockResponse = Record<string, unknown>

export class MockJiraClient implements IJiraClient {
  private getResponses = new Map<string, MockResponse>()
  private postResponses = new Map<string, MockResponse>()
  private putResponses = new Map<string, MockResponse>()
  public calls: Array<{ method: string; path: string; body?: unknown }> = []

  onGet(path: string, response: MockResponse): this {
    this.getResponses.set(path, response)
    return this
  }

  onPost(path: string, response: MockResponse): this {
    this.postResponses.set(path, response)
    return this
  }

  onPut(path: string, response: MockResponse): this {
    this.putResponses.set(path, response)
    return this
  }

  async get<T>(path: string): Promise<T> {
    this.calls.push({ method: "GET", path })
    const res = this.getResponses.get(path)
    if (!res) throw new Error(`MockJiraClient: no GET response for ${path}`)
    return res as T
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    this.calls.push({ method: "POST", path, body })
    const res = this.postResponses.get(path)
    if (!res) throw new Error(`MockJiraClient: no POST response for ${path}`)
    return res as T
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    this.calls.push({ method: "PUT", path, body })
    const res = this.putResponses.get(path)
    if (!res) throw new Error(`MockJiraClient: no PUT response for ${path}`)
    return res as T
  }

  getCalls(method: string, path?: string) {
    return this.calls.filter(
      (c) => c.method === method && (!path || c.path === path)
    )
  }
}
