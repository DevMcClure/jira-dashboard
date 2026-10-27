/**
 * Shared test setup: placeholder settings, an app on in-memory stores, and a
 * sign-in helper. (Not a test file itself; only imported by tests.)
 */
import small from "@jira-dashboard/core/__fixtures__/small-export.json" with { type: "json" }
import type { FastifyInstance } from "fastify"
import { buildApp } from "./app"
import { createMemoryAuthStore } from "./auth/auth-store"
import { createMockAuthProvider } from "./auth/mock-provider"
import type { AuthProvider } from "./auth/provider"
import { createMemoryDatasetStore } from "./dataset-store"
import { loadEnv, type Env } from "./env"
import { createMemoryReportStore } from "./reports/store"
import { createMemorySettingsStore } from "./settings/store"
import { createMemorySnapshotStore } from "./snapshots/store"
import { seedIfEmpty } from "./seed"

/** Placeholder settings only, like .env.example. */
export const TEST_ENV_VARS: Record<string, string> = {
  HOST: "127.0.0.1",
  PORT: "3000",
  CORS_ORIGIN: "http://localhost:5173",
  LOG_LEVEL: "silent",
  MONGO_URI: "mongodb://localhost:27017",
  MONGO_DB_NAME: "jira_dashboard_test",
  SESSION_SECRET: "test-only-secret-that-is-long-enough-123",
}

export const testEnv = (overrides: Record<string, string> = {}): Env => loadEnv({ ...TEST_ENV_VARS, ...overrides })

type MakeOptions = {
  env?: Record<string, string>
  failPing?: boolean
  seed?: boolean
  provider?: (env: Env) => AuthProvider
  now?: () => Date
}

export async function makeApp(opts: MakeOptions = {}) {
  const env = testEnv(opts.env)
  const store = createMemoryDatasetStore({ failPing: opts.failPing })
  if (opts.seed !== false) await seedIfEmpty(store)
  const authStore = createMemoryAuthStore()
  const provider = (opts.provider ?? createMockAuthProvider)(env)
  const snapshots = createMemorySnapshotStore()
  const reports = createMemoryReportStore()
  const settings = createMemorySettingsStore()
  const app = await buildApp({ env, store, auth: { provider, store: authStore, now: opts.now }, snapshots, reports, settings, version: "1.2.3", logger: false })
  return { app, env, store, authStore, provider, snapshots, reports, settings }
}

/** Sign in and return the Cookie header to send on later requests. */
export async function signIn(app: FastifyInstance, username = "sam.scrum", password = "", prefix = "") {
  const res = await app.inject({ method: "POST", url: `${prefix}/api/auth/login`, payload: { username, password } })
  if (res.statusCode !== 200) throw new Error(`sign-in failed: ${res.statusCode} ${res.body}`)
  const setCookie = String(res.headers["set-cookie"])
  return setCookie.split(";")[0]
}

// --- Export fixtures, one of each shape the pipeline accepts (made-up data).

/** The contract shape (core's small fixture: 1 team, 3 issues). */
export const CONTRACT_JSON = JSON.stringify(small)

const ticket = (key: string, status: string, statusCategory: string) => ({
  id: key.replace(/\D/g, ""),
  key,
  project: "PLAT",
  summary: `Ticket ${key}`,
  issuetype: "Story",
  status,
  statusCategory,
  assignee: { name: "pshah", key: "JIRAUSER1", displayName: "Priya Shah" },
  reporter: null,
  creator: null,
  created: "2026-10-01T09:00:00.000+0000",
  updated: "2026-10-15T12:30:00.000+0000",
  resolutiondate: null,
})
const project = { id: "10000", key: "PLAT", name: "Platform" }

/** Raw Trawler JSON (Jira's own field names). */
export const TRAWLER_JSON = JSON.stringify({ projects: [project], tickets: [ticket("PLAT-1", "In Progress", "In Progress"), ticket("PLAT-2", "To Do", "To Do")] })

/** The Trawler's audit log. */
export const TRAWLER_LOG = [
  "2026-10-20 08:15:00,123 INFO Connecting to https://jira.example.com",
  `2026-10-20 08:15:01,100 INFO PROJECT ${JSON.stringify(project)}`,
  `2026-10-20 08:15:02,000 INFO TICKET ${JSON.stringify(ticket("PLAT-1", "In Progress", "In Progress"))}`,
  "2026-10-20 08:15:03,500 INFO Done. projects=1 with_tickets=1",
].join("\n")

/** Valid JSON, but not an export. */
export const NOT_AN_EXPORT = JSON.stringify({ issues: [{ key: 42 }] })
