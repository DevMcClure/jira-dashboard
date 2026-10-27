/**
 * Shared test setup: placeholder settings, an app on in-memory stores, and a
 * sign-in helper. (Not a test file itself; only imported by tests.)
 */
import type { FastifyInstance } from "fastify"
import { buildApp } from "./app"
import { createMemoryAuthStore } from "./auth/auth-store"
import { createMockAuthProvider } from "./auth/mock-provider"
import type { AuthProvider } from "./auth/provider"
import { createMemoryDatasetStore } from "./dataset-store"
import { loadEnv, type Env } from "./env"
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
  const app = await buildApp({ env, store, auth: { provider, store: authStore, now: opts.now }, version: "1.2.3", logger: false })
  return { app, env, store, authStore, provider }
}

/** Sign in and return the Cookie header to send on later requests. */
export async function signIn(app: FastifyInstance, username = "sam.scrum", password = "", prefix = "") {
  const res = await app.inject({ method: "POST", url: `${prefix}/api/auth/login`, payload: { username, password } })
  if (res.statusCode !== 200) throw new Error(`sign-in failed: ${res.statusCode} ${res.body}`)
  const setCookie = String(res.headers["set-cookie"])
  return setCookie.split(";")[0]
}
