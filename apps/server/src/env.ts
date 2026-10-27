/**
 * Every setting the server reads, validated at startup. All of them come from
 * the environment (a root .env in development); none are hard-coded. See
 * .env.example and docs/plan-backend.md → "Configuration template".
 */
import { z } from "zod"

const bool = z
  .enum(["true", "false", "1", "0", "yes", "no"], { message: "must be true or false" })
  .transform((v) => v === "true" || v === "1" || v === "yes")

const required = (name: string) => z.string({ message: `${name} is required` }).trim().min(1, `${name} is required`)

const positiveNumber = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform(Number)
    .pipe(z.number({ message: "must be a number" }).positive("must be more than 0"))

/** A comma-separated list ("a, b") → ["a", "b"]. */
const list = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((s) =>
      s
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    )

/** A URL path prefix: "/" or "/something" (no trailing slash). */
const basePath = z
  .string()
  .trim()
  .default("/")
  .refine((p) => p.startsWith("/"), { message: "must start with /" })
  .transform((p) => (p === "/" ? "" : p.replace(/\/+$/, "")))

const envSchema = z.object({
  // --- Server (B1)
  HOST: required("HOST"),
  PORT: required("PORT")
    .transform(Number)
    .pipe(z.number({ message: "must be a number" }).int("must be a whole number").min(1, "must be 1–65535").max(65535, "must be 1–65535")),
  BASE_PATH: basePath,
  CORS_ORIGIN: required("CORS_ORIGIN").transform((s) =>
    s
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  ),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** Behind a proxy that terminates TLS, trust its X-Forwarded-* headers (so cookies get `Secure`). */
  TRUST_PROXY: bool.default(false),

  // --- MongoDB (B1)
  MONGO_URI: required("MONGO_URI").refine((u) => /^mongodb(\+srv)?:\/\//.test(u), {
    message: "must start with mongodb:// or mongodb+srv://",
  }),
  MONGO_DB_NAME: required("MONGO_DB_NAME"),
  MONGO_TLS_CA_FILE: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  SEED_MOCK: bool.default(false),

  // --- Sign-in (B2)
  AUTH_PROVIDER: z.enum(["mock", "crowd", "oidc"], { message: "must be mock, crowd or oidc" }).default("mock"),
  SESSION_SECRET: required("SESSION_SECRET"),
  SESSION_TTL_HOURS: positiveNumber("12"),
  CROWD_URL: z.string().trim().optional(),
  CROWD_APP_NAME: z.string().trim().optional(),
  CROWD_APP_PASSWORD: z.string().optional(),
  CROWD_REVALIDATE_MINUTES: positiveNumber("15"),
  ROLE_GROUPS_ADMIN: list("jira-dashboard-admins"),
  ROLE_GROUPS_AUTHOR: list("jira-dashboard-authors"),
})

export type Env = z.output<typeof envSchema>

/** The placeholder in .env.example; fine for mock sign-in, never for Crowd. */
const PLACEHOLDER_SECRET = "change-me"
const MIN_SECRET_LENGTH = 32

export class EnvError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`The server can't start; fix these settings (see .env.example):\n${problems.map((p) => `  - ${p}`).join("\n")}`)
    this.name = "EnvError"
    this.problems = problems
  }
}

/** Settings that only matter for one provider (checked on the raw values, so they're listed with everything else). */
function providerProblems(raw: Record<string, string>): string[] {
  if (raw.AUTH_PROVIDER !== "crowd") return []
  const problems: string[] = []
  if (!raw.CROWD_URL) problems.push("CROWD_URL is required when AUTH_PROVIDER=crowd")
  else if (!/^https?:\/\/\S+$/.test(raw.CROWD_URL)) problems.push("CROWD_URL: must be an http(s) URL")
  if (!raw.CROWD_APP_NAME) problems.push("CROWD_APP_NAME is required when AUTH_PROVIDER=crowd")
  if (!raw.CROWD_APP_PASSWORD) problems.push("CROWD_APP_PASSWORD is required when AUTH_PROVIDER=crowd")
  const secret = raw.SESSION_SECRET ?? ""
  if (secret && (secret === PLACEHOLDER_SECRET || secret.length < MIN_SECRET_LENGTH)) {
    problems.push(`SESSION_SECRET: use a random string of at least ${MIN_SECRET_LENGTH} characters with AUTH_PROVIDER=crowd`)
  }
  return problems
}

/** Typed settings from an environment object, or an EnvError listing every missing or invalid variable. */
export function loadEnv(source: Record<string, string | undefined>): Env {
  // Treat empty strings as unset, so `MONGO_TLS_CA_FILE=` in .env means "not used".
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string>
  const result = envSchema.safeParse(cleaned)
  const problems = result.success
    ? []
    : result.error.issues.map((i) => {
        const name = String(i.path[0] ?? "env")
        return i.message.startsWith(name) ? i.message : `${name}: ${i.message}`
      })
  problems.push(...providerProblems(cleaned))
  if (problems.length || !result.success) throw new EnvError(problems)
  return result.data
}

/** Things worth saying at startup that don't stop the server. */
export function envWarnings(env: Env): string[] {
  const warnings: string[] = []
  if (env.AUTH_PROVIDER === "mock") {
    warnings.push("AUTH_PROVIDER=mock: anyone can sign in as a demo persona. Use crowd for real users.")
  }
  if (env.SESSION_SECRET === PLACEHOLDER_SECRET || env.SESSION_SECRET.length < MIN_SECRET_LENGTH) {
    warnings.push(`SESSION_SECRET is a placeholder or shorter than ${MIN_SECRET_LENGTH} characters; set a long random value before real use.`)
  }
  return warnings
}
