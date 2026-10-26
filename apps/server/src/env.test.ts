import { describe, expect, it } from "vitest"
import { EnvError, loadEnv } from "./env"

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
      MONGO_URI: "mongodb://localhost:27017",
      MONGO_DB_NAME: "jira_dashboard",
      MONGO_TLS_CA_FILE: undefined,
      SEED_MOCK: true,
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
    const { BASE_PATH: _b, LOG_LEVEL: _l, SEED_MOCK: _s, ...rest } = valid
    expect(loadEnv(rest)).toMatchObject({ BASE_PATH: "", LOG_LEVEL: "info", SEED_MOCK: false })
  })
})
