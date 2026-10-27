import { describe, expect, it } from "vitest"
import { EnvError, envWarnings, loadEnv } from "./env"

// Placeholders only, like .env.example.
const valid = {
  HOST: "0.0.0.0",
  PORT: "3000",
  BASE_PATH: "/",
  CORS_ORIGIN: "http://localhost:5173",
  LOG_LEVEL: "info",
  MONGO_URI: "mongodb://localhost:27017",
  MONGO_DB_NAME: "jira_dashboard",
  MONGO_TLS_CA_FILE: "",
  SEED_MOCK: "true",
  AUTH_PROVIDER: "mock",
  SESSION_SECRET: "change-me",
}

const problems = (env: Record<string, string | undefined>) => {
  try {
    loadEnv(env)
    return []
  } catch (err) {
    expect(err).toBeInstanceOf(EnvError)
    return (err as EnvError).problems
  }
}

describe("loadEnv", () => {
  it("parses a complete environment into typed settings", () => {
    expect(loadEnv(valid)).toEqual({
      HOST: "0.0.0.0",
      PORT: 3000,
      BASE_PATH: "",
      CORS_ORIGIN: ["http://localhost:5173"],
      LOG_LEVEL: "info",
      TRUST_PROXY: false,
      MONGO_URI: "mongodb://localhost:27017",
      MONGO_DB_NAME: "jira_dashboard",
      MONGO_TLS_CA_FILE: undefined,
      SEED_MOCK: true,
      AUTH_PROVIDER: "mock",
      SESSION_SECRET: "change-me",
      SESSION_TTL_HOURS: 12,
      CROWD_URL: undefined,
      CROWD_APP_NAME: undefined,
      CROWD_APP_PASSWORD: undefined,
      CROWD_REVALIDATE_MINUTES: 15,
      ROLE_GROUPS_ADMIN: ["jira-dashboard-admins"],
      ROLE_GROUPS_AUTHOR: ["jira-dashboard-authors"],
    })
  })

  it("normalises a sub-path, a list of origins and a CA file", () => {
    const env = loadEnv({ ...valid, BASE_PATH: "/dash/", CORS_ORIGIN: "https://a.example, https://b.example", MONGO_TLS_CA_FILE: "/etc/ca.pem" })
    expect([env.BASE_PATH, env.CORS_ORIGIN, env.MONGO_TLS_CA_FILE]).toEqual(["/dash", ["https://a.example", "https://b.example"], "/etc/ca.pem"])
  })

  it("lists every missing setting at once", () => {
    expect(problems({})).toEqual([
      "HOST is required",
      "PORT is required",
      "CORS_ORIGIN is required",
      "MONGO_URI is required",
      "MONGO_DB_NAME is required",
      "SESSION_SECRET is required",
    ])
  })

  it("rejects malformed values with a readable reason", () => {
    expect(problems({ ...valid, PORT: "eighty", MONGO_URI: "postgres://x", SEED_MOCK: "maybe", BASE_PATH: "dash" })).toEqual([
      "PORT: must be a number",
      "BASE_PATH: must start with /",
      "MONGO_URI: must start with mongodb:// or mongodb+srv://",
      "SEED_MOCK: must be true or false",
    ])
    expect(problems({ ...valid, PORT: "70000" })).toEqual(["PORT: must be 1–65535"])
  })

  it("defaults optional settings", () => {
    const { BASE_PATH: _b, LOG_LEVEL: _l, SEED_MOCK: _s, AUTH_PROVIDER: _a, ...rest } = valid
    expect(loadEnv(rest)).toMatchObject({ BASE_PATH: "", LOG_LEVEL: "info", SEED_MOCK: false, AUTH_PROVIDER: "mock", TRUST_PROXY: false })
  })

  it("needs the Crowd settings, and a strong secret, only with AUTH_PROVIDER=crowd", () => {
    expect(problems({ ...valid, AUTH_PROVIDER: "crowd" })).toEqual([
      "CROWD_URL is required when AUTH_PROVIDER=crowd",
      "CROWD_APP_NAME is required when AUTH_PROVIDER=crowd",
      "CROWD_APP_PASSWORD is required when AUTH_PROVIDER=crowd",
      "SESSION_SECRET: use a random string of at least 32 characters with AUTH_PROVIDER=crowd",
    ])
    const crowd = {
      ...valid,
      AUTH_PROVIDER: "crowd",
      CROWD_URL: "https://crowd.example.com/crowd",
      CROWD_APP_NAME: "jira-dashboard",
      CROWD_APP_PASSWORD: "change-me",
      SESSION_SECRET: "x".repeat(40),
    }
    expect(loadEnv(crowd)).toMatchObject({ AUTH_PROVIDER: "crowd", CROWD_URL: "https://crowd.example.com/crowd" })
    expect(problems({ ...crowd, CROWD_URL: "crowd.example.com" })).toEqual(["CROWD_URL: must be an http(s) URL"])
    expect(problems({ ...valid, AUTH_PROVIDER: "saml" })).toEqual(["AUTH_PROVIDER: must be mock, crowd or oidc"])
  })

  it("parses role groups and session timings", () => {
    const env = loadEnv({ ...valid, ROLE_GROUPS_ADMIN: "ops, leads", ROLE_GROUPS_AUTHOR: "sm", SESSION_TTL_HOURS: "8", CROWD_REVALIDATE_MINUTES: "5", TRUST_PROXY: "true" })
    expect([env.ROLE_GROUPS_ADMIN, env.ROLE_GROUPS_AUTHOR, env.SESSION_TTL_HOURS, env.CROWD_REVALIDATE_MINUTES, env.TRUST_PROXY]).toEqual([
      ["ops", "leads"], ["sm"], 8, 5, true,
    ])
    expect(problems({ ...valid, SESSION_TTL_HOURS: "0" })).toEqual(["SESSION_TTL_HOURS: must be more than 0"])
  })

  it("warns about mock sign-in and a placeholder secret without refusing to start", () => {
    expect(envWarnings(loadEnv(valid))).toHaveLength(2)
    expect(envWarnings(loadEnv({ ...valid, SESSION_SECRET: "y".repeat(40) }))).toHaveLength(1)
  })
})
